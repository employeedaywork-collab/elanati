import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> };

interface VercelRequestLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
}

interface VercelResponseLike {
  status: (code: number) => VercelResponseLike;
  json: (payload: unknown) => void;
}

function getHeader(req: VercelRequestLike, name: string): string {
  const val = req.headers[name] || req.headers[name.toLowerCase()];
  return (Array.isArray(val) ? val[0] : val || '').trim();
}

function extractClientIp(req: VercelRequestLike): string {
  const xff = getHeader(req, 'x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim() || '';
    if (first) return first;
  }
  const realIp = getHeader(req, 'x-real-ip') || getHeader(req, 'cf-connecting-ip');
  return realIp.trim();
}

function maskIpHint(ip: string): string {
  const clean = ip.trim();
  if (!clean) return 'غير معروف';
  if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`;
    }
  }
  if (clean.includes(':')) {
    const parts = clean.split(':').filter(Boolean);
    return `${parts.slice(0, 2).join(':')}:*`;
  }
  return 'محمي';
}

function hashIdentifier(pepper: string, scope: string, raw: string): string {
  const clean = raw.trim();
  if (!clean) return '';
  return crypto.createHash('sha256').update(`${pepper}:${scope}:${clean}`).digest('hex');
}

function normalizeDigits(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('201') && digits.length === 12) return digits.slice(1);
  if (digits.startsWith('00201') && digits.length === 14) return digits.slice(3);
  return digits;
}

function toWhatsAppDigits(phone: string): string {
  const digits = normalizeDigits(phone);
  if (digits.startsWith('01') && digits.length === 11) return `2${digits}`;
  if (digits.startsWith('00')) return digits.slice(2);
  return digits;
}

function normalizeClientName(name?: string | null): string {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function maskPhone(phone: string): string {
  const d = normalizeDigits(phone);
  if (d.length <= 5) return '•••••';
  return `${d.slice(0, 3)}•••••${d.slice(-3)}`;
}

function sanitizeHttpUrl(raw?: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function sanitizeSpecs(raw: unknown): Record<string, string | number | boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string | number | boolean> = {};
  const entries = Object.entries(raw as Record<string, unknown>).slice(0, 20);
  for (const [k, v] of entries) {
    const cleanKey = k.trim().slice(0, 40);
    if (!cleanKey) continue;
    if (typeof v === 'string') {
      const cleanVal = v.trim().slice(0, 120);
      if (cleanVal) out[cleanKey] = cleanVal;
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      out[cleanKey] = v;
    } else if (typeof v === 'boolean') {
      out[cleanKey] = v;
    }
  }
  return out;
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'إعدادات الخادم غير مكتملة' });
  }

  const pepper = (process.env.IP_HASH_PEPPER || process.env.CRON_SECRET || serviceKey).trim();
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = req.body || {};
  const action = String(body.action || '').trim();
  const rawIp = extractClientIp(req);
  const ipHint = maskIpHint(rawIp);
  const ipHash = rawIp ? hashIdentifier(pepper, 'ip', rawIp) : '';
  const rawDeviceId = String(body.deviceId || '').trim();
  const deviceHash = rawDeviceId.length >= 8 ? hashIdentifier(pepper, 'dev', rawDeviceId) : '';

  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  async function evaluateAllowance(params: {
    contact: string;
    subscriptionCode: string;
    clientName: string;
  }) {
    const digits = normalizeDigits(params.contact);
    const cleanCode = params.subscriptionCode.trim().toUpperCase();
    const normName = normalizeClientName(params.clientName);

    const { data: settingsRow } = await supabase
      .from('elanati_site_settings')
      .select('free_ad_days, pro_ad_days, require_ad_approval')
      .eq('id', 1)
      .maybeSingle();

    const freeDays = Math.max(1, Number(settingsRow?.free_ad_days || 7));
    const proDays = Math.max(1, Number(settingsRow?.pro_ad_days || 30));
    const requireApproval = settingsRow?.require_ad_approval ?? true;

    let activeSub: any = null;
    if (cleanCode) {
      const { data: reqRows } = await supabase
        .from('elanati_package_requests')
        .select('*')
        .eq('status', 'activated')
        .ilike('subscription_code', cleanCode)
        .order('created_at', { ascending: false })
        .limit(5);

      activeSub = (reqRows || []).find((r: any) => {
        const notExpired = !r.expires_at || new Date(r.expires_at).getTime() > Date.now();
        const phoneMatch = !digits || normalizeDigits(r.client_phone) === digits;
        return notExpired && phoneMatch;
      });
    }

    if (activeSub) {
      const { count: usedAds } = await supabase
        .from('elanati_ads')
        .select('id', { count: 'exact', head: true })
        .in('status', ['approved', 'pending'])
        .ilike('subscription_code', activeSub.subscription_code)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

      const isEnterprise = activeSub.package_name === 'المؤسسي';
      const maxAds = Number(activeSub.max_ads || (isEnterprise ? 999999 : 10));
      const used = usedAds || 0;

      return {
        requireApproval,
        allowance: {
          allowed: used < maxAds,
          package_name: activeSub.package_name,
          subscription_code: activeSub.subscription_code,
          subscription_expires_at: activeSub.expires_at || null,
          max_ads: maxAds,
          used_ads: used,
          duration_days: isEnterprise ? null : proDays,
          is_permanent: isEnterprise,
          featured: true,
          priority_rank: isEnterprise ? 2 : 1,
          allow_extra_images: true,
          max_images: 6,
          allow_banner: isEnterprise,
          free_trial_used: false,
          free_block_reason: null as 'phone' | 'name' | 'ip_device' | 'both' | null,
          cooldown_days: 30,
        },
      };
    }

    // Free allowance check across 30-day rolling window: phone, normalized name, IP hash, Device hash
    const { data: recentFreeAds } = await supabase
      .from('elanati_ads')
      .select('id, contact, client_name, ip_hash, device_hash')
      .eq('package_name', 'مجاني')
      .neq('status', 'rejected')
      .gte('created_at', thirtyDaysAgoIso)
      .limit(1000);

    const rows = recentFreeAds || [];
    const usedByPhone = Boolean(digits && rows.some((r: any) => normalizeDigits(r.contact) === digits));
    const usedByName = Boolean(
      normName && rows.some((r: any) => normalizeClientName(r.client_name) === normName)
    );
    const usedByIp = Boolean(ipHash && rows.some((r: any) => r.ip_hash && r.ip_hash === ipHash));
    const usedByDevice = Boolean(
      deviceHash && rows.some((r: any) => r.device_hash && r.device_hash === deviceHash)
    );

    const freeTrialUsed = usedByPhone || usedByName || usedByIp || usedByDevice;
    let blockReason: 'phone' | 'name' | 'ip_device' | 'both' | null = null;
    if (usedByPhone && usedByName) {
      blockReason = 'both';
    } else if (usedByPhone) {
      blockReason = 'phone';
    } else if (usedByName) {
      blockReason = 'name';
    } else if (usedByIp || usedByDevice) {
      blockReason = 'ip_device';
    }

    return {
      requireApproval,
      allowance: {
        allowed: !freeTrialUsed,
        package_name: 'مجاني',
        subscription_code: null,
        subscription_expires_at: null,
        max_ads: 1,
        used_ads: freeTrialUsed ? 1 : 0,
        duration_days: freeDays,
        is_permanent: false,
        featured: false,
        priority_rank: 0,
        allow_extra_images: false,
        max_images: 1,
        allow_banner: false,
        free_trial_used: freeTrialUsed,
        free_block_reason: blockReason,
        cooldown_days: 30,
      },
    };
  }

  // 1) Pre-check allowance
  if (action === 'check') {
    const contact = String(body.contact || '');
    const subscriptionCode = String(body.subscriptionCode || '');
    const clientName = String(body.clientName || '');

    const { allowance } = await evaluateAllowance({
      contact,
      subscriptionCode,
      clientName,
    });

    return res.status(200).json({ ok: true, allowance });
  }

  // 2) Submit a new ad with anti-abuse IP + device hash enforcement
  if (action === 'submit') {
    const clientName = String(body.client_name || '').trim();
    const title = String(body.title || '').trim();
    const category = String(body.category || '').trim().replace(/\s+/g, ' ');
    const description = String(body.description || '').trim();
    const contact = String(body.contact || '').trim();
    const city = String(body.city || '').trim();
    const image = String(body.image || '📦').trim() || '📦';
    const subscriptionCode = String(body.subscription_code || '').trim().toUpperCase();

    if (clientName.length < 2) {
      return res.status(400).json({ error: 'يرجى إدخال اسم المعلن أو المسؤول' });
    }
    if (title.length < 3 || title.length > 140) {
      return res.status(400).json({ error: 'عنوان الإعلان يجب أن يكون بين 3 و140 حرفاً' });
    }
    if (category.length < 2 || category.length > 60) {
      return res.status(400).json({ error: 'يرجى اختيار أو كتابة تصنيف صحيح' });
    }
    if (description.length < 5) {
      return res.status(400).json({ error: 'يرجى كتابة وصف واضح للإعلان' });
    }
    if (normalizeDigits(contact).length < 10) {
      return res.status(400).json({ error: 'يرجى إدخال رقم هاتف صحيح' });
    }
    if (city.length < 2) {
      return res.status(400).json({ error: 'يرجى اختيار المحافظة' });
    }

    const { allowance, requireApproval } = await evaluateAllowance({
      contact,
      subscriptionCode,
      clientName,
    });

    if (!allowance.allowed) {
      let blockMessage =
        'لقد وصلت للحد الأقصى لإعلانات باقتك الحالية. يمكنك الترقية إلى الباقة الاحترافية أو المؤسسية.';
      if (allowance.package_name === 'مجاني') {
        if (allowance.free_block_reason === 'ip_device') {
          blockMessage =
            'تم رصد استخدام الإعلان المجاني من نفس الشبكة أو الجهاز خلال آخر 30 يوماً. الباقة المجانية متاحة لإعلان واحد كل 30 يوم، يمكنك الترقية للباقة الاحترافية أو المؤسسية.';
        } else if (allowance.free_block_reason === 'both') {
          blockMessage =
            'تم استخدام الإعلان المجاني لهذا الرقم واسم المعلن خلال آخر 30 يوماً. يمكنك الترقية لإضافة إعلانات جديدة.';
        } else if (allowance.free_block_reason === 'name') {
          blockMessage =
            'اسم المعلن هذا استخدم الإعلان المجاني خلال آخر 30 يوماً. يمكنك الترقية لإضافة إعلانات جديدة.';
        } else {
          blockMessage =
            'رقم الموبايل هذا استخدم الإعلان المجاني خلال آخر 30 يوماً. يمكنك الترقية لإضافة إعلانات جديدة.';
        }
      }

      await supabase.from('elanati_access_logs').insert({
        event_type: 'ad_submit_blocked',
        actor_label: `${clientName.slice(0, 40)} (${maskPhone(contact)})`,
        ip_hint: ipHint,
        ip_hash: ipHash || null,
        device_hash: deviceHash || null,
        reason: `حظر إعلان مكرر (${allowance.free_block_reason || 'quota'})`,
        metadata: {
          package_name: allowance.package_name,
          block_reason: allowance.free_block_reason,
          category,
          city,
        },
      });

      return res.status(429).json({ error: blockMessage, allowance });
    }

    const rawImageUrl = body.image_url ? String(body.image_url).trim() : '';
    const safeImageUrl = rawImageUrl ? sanitizeHttpUrl(rawImageUrl) : null;
    if (rawImageUrl && !safeImageUrl) {
      return res.status(400).json({ error: 'رابط الصورة الرئيسية غير صالح' });
    }

    const isPaid = allowance.package_name !== 'مجاني';
    const rawExtras: string[] = Array.isArray(body.extra_images)
      ? body.extra_images.map((u: unknown) => String(u || '').trim()).filter(Boolean)
      : [];

    if (!isPaid && rawExtras.length > 0) {
      return res.status(400).json({
        error: 'الباقة المجانية تسمح بصورة واحدة فقط. احذف الصور الإضافية أو قم بالترقية حتى 6 صور.',
      });
    }

    const safeExtras: string[] = [];
    for (const url of rawExtras.slice(0, 5)) {
      const safe = sanitizeHttpUrl(url);
      if (!safe) {
        return res.status(400).json({ error: 'أحد روابط الصور الإضافية غير صالح' });
      }
      safeExtras.push(safe);
    }

    const rawBanner = allowance.allow_banner && body.banner_url ? String(body.banner_url).trim() : '';
    const safeBanner = rawBanner ? sanitizeHttpUrl(rawBanner) : null;
    if (rawBanner && !safeBanner) {
      return res.status(400).json({ error: 'رابط البانر الإعلاني غير صالح' });
    }

    const rawPrice = body.price;
    const price =
      rawPrice !== undefined && rawPrice !== null && rawPrice !== '' && Number.isFinite(Number(rawPrice))
        ? Math.max(0, Math.min(999999999, Number(rawPrice)))
        : null;
    const priceNegotiable = Boolean(body.price_negotiable);
    const rawCondition = String(body.item_condition || 'unspecified');
    const itemCondition =
      rawCondition === 'new' || rawCondition === 'used' ? rawCondition : 'unspecified';
    const specs = sanitizeSpecs(body.specs);

    const rawLat = body.latitude;
    const rawLng = body.longitude;
    const hasCoords =
      rawLat !== null &&
      rawLat !== undefined &&
      rawLng !== null &&
      rawLng !== undefined &&
      Number.isFinite(Number(rawLat)) &&
      Number.isFinite(Number(rawLng)) &&
      Number(rawLat) >= -90 &&
      Number(rawLat) <= 90 &&
      Number(rawLng) >= -180 &&
      Number(rawLng) <= 180;
    const latitude = hasCoords ? Number(rawLat) : null;
    const longitude = hasCoords ? Number(rawLng) : null;
    const locationAddress = body.location_address
      ? String(body.location_address).trim().slice(0, 200) || null
      : null;

    await supabase
      .from('elanati_categories')
      .upsert({ name: category, sort_order: 20, is_active: true }, { onConflict: 'name' });

    const now = new Date();
    const nowIso = now.toISOString();
    let expiresAt: string | null = null;
    if (!allowance.is_permanent && allowance.duration_days) {
      expiresAt =
        allowance.subscription_expires_at && allowance.package_name !== 'مجاني'
          ? allowance.subscription_expires_at
          : new Date(now.getTime() + allowance.duration_days * 24 * 60 * 60 * 1000).toISOString();
    }

    const ownerPin = crypto.randomBytes(4).toString('hex').toUpperCase();
    const status = requireApproval ? 'pending' : 'approved';

    const { data: inserted, error: insertErr } = await supabase
      .from('elanati_ads')
      .insert({
        client_name: clientName,
        title,
        category,
        description,
        contact,
        whatsapp: toWhatsAppDigits(contact),
        city,
        image,
        image_url: safeImageUrl,
        extra_images: isPaid ? safeExtras : [],
        banner_url: safeBanner,
        price,
        price_negotiable: priceNegotiable,
        item_condition: itemCondition,
        specs,
        latitude,
        longitude,
        location_address: locationAddress,
        package_name: allowance.package_name,
        subscription_code: allowance.subscription_code,
        owner_pin: ownerPin,
        priority_rank: allowance.priority_rank,
        status,
        featured: allowance.featured,
        views_count: 0,
        starts_at: nowIso,
        expires_at: expiresAt,
        ip_hash: ipHash || null,
        device_hash: deviceHash || null,
      })
      .select(
        'id, client_name, title, category, description, contact, whatsapp, city, image, image_url, extra_images, banner_url, price, price_negotiable, item_condition, specs, latitude, longitude, location_address, package_name, subscription_code, priority_rank, status, featured, views_count, starts_at, expires_at, created_at, updated_at'
      )
      .single();

    if (insertErr) {
      return res.status(400).json({ error: insertErr.message || 'تعذر حفظ الإعلان' });
    }

    await supabase.from('elanati_access_logs').insert({
      event_type: 'ad_submit_ok',
      actor_label: `${clientName.slice(0, 40)} (${maskPhone(contact)})`,
      ip_hint: ipHint,
      ip_hash: ipHash || null,
      device_hash: deviceHash || null,
      reason: `نشر إعلان (${allowance.package_name})`,
      metadata: {
        ad_id: inserted.id,
        category,
        city,
        package_name: allowance.package_name,
      },
    });

    return res.status(200).json({
      ok: true,
      requiresReview: requireApproval,
      ad: { ...inserted, owner_pin: ownerPin },
    });
  }

  // 3) Submit a violation report for an ad
  if (action === 'report') {
    const adId = body.adId ? String(body.adId).trim() : null;
    const adTitle = String(body.adTitle || '').trim().slice(0, 200);
    const reason = String(body.reason || '').trim().slice(0, 200);
    const details = body.details ? String(body.details).trim().slice(0, 800) : null;
    const reporterPhone = body.reporterPhone
      ? String(body.reporterPhone).trim().slice(0, 30)
      : null;

    if (adTitle.length < 2 || reason.length < 2) {
      return res.status(400).json({ error: 'يرجى تحديد سبب البلاغ' });
    }

    if (ipHash) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('elanati_ad_reports')
        .select('id', { count: 'exact', head: true })
        .eq('reporter_ip_hash', ipHash)
        .gte('created_at', oneHourAgo);

      if ((count || 0) >= 5) {
        return res.status(429).json({ error: 'تم إرسال عدة بلاغات بالفعل، يرجى المحاولة لاحقاً' });
      }
    }

    const { data: reportRow, error: repErr } = await supabase
      .from('elanati_ad_reports')
      .insert({
        ad_id: adId,
        ad_title: adTitle,
        reason,
        details,
        reporter_phone: reporterPhone,
        reporter_ip_hash: ipHash || null,
        status: 'open',
      })
      .select('id, ad_id, ad_title, reason, details, reporter_phone, status, created_at')
      .single();

    if (repErr) {
      return res.status(500).json({ error: 'تعذر إرسال البلاغ، حاول مرة أخرى' });
    }

    await supabase.from('elanati_access_logs').insert({
      event_type: 'ad_report',
      actor_label: reporterPhone ? maskPhone(reporterPhone) : 'زائر',
      ip_hint: ipHint,
      ip_hash: ipHash || null,
      device_hash: deviceHash || null,
      reason: `بلاغ عن إعلان: ${reason}`,
      metadata: { ad_id: adId, ad_title: adTitle },
    });

    return res.status(200).json({ ok: true, report: reportRow });
  }

  return res.status(400).json({ error: 'إجراء غير صالح' });
}
