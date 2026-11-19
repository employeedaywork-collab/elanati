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
  const val = req.headers[name.toLowerCase()];
  if (Array.isArray(val)) return val[0] || '';
  return val || '';
}

function normalizeWhatsAppDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('01') && digits.length === 11) {
    return `2${digits}`;
  }
  if (digits.startsWith('00')) {
    return digits.slice(2);
  }
  return digits;
}

function renderTemplate(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [key, val] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(String(val));
  }
  return out;
}

async function dispatchWhatsAppMessage(params: {
  provider: string;
  endpoint: string;
  token: string;
  phone: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; responseText: string }> {
  const to = normalizeWhatsAppDigits(params.phone);
  if (!to || to.length < 10) {
    return { ok: false, responseText: 'رقم الهاتف غير صالح للإرسال' };
  }

  const endpoint = params.endpoint.trim();
  const token = params.token.trim();

  if (!endpoint) {
    return { ok: false, responseText: 'لم يتم إعداد رابط أو معرّف ربط الواتساب بعد' };
  }

  try {
    if (params.provider === 'meta_cloud') {
      // endpoint is Phone Number ID or full graph URL
      const url = endpoint.startsWith('http')
        ? endpoint
        : `https://graph.facebook.com/v20.0/${endpoint}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { preview_url: false, body: params.message },
        }),
      });
      const text = await res.text();
      return { ok: res.ok, responseText: text.slice(0, 400) };
    }

    if (params.provider === 'ultramsg') {
      // endpoint is instance ID (e.g. instance12345) or full https://api.ultramsg.com/instance.../messages/chat
      const url = endpoint.startsWith('http')
        ? endpoint
        : `https://api.ultramsg.com/${endpoint}/messages/chat`;
      const body = new URLSearchParams({
        token,
        to: `+${to}`,
        body: params.message,
      });
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const text = await res.text();
      return { ok: res.ok, responseText: text.slice(0, 400) };
    }

    // Generic Webhook (n8n / Make.com / Evolution API / Custom Gateway)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone: to,
        international_phone: `+${to}`,
        message: params.message,
        ...params.metadata,
      }),
    });
    const text = await res.text();
    return { ok: res.ok, responseText: text.slice(0, 400) };
  } catch (err: any) {
    return { ok: false, responseText: err?.message || 'Network error' };
  }
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || (!serviceKey && !anonKey)) {
    return res.status(500).json({ error: 'بيانات الاتصال بقاعدة البيانات غير مكتملة على الخادم' });
  }

  const authHeader = getHeader(req, 'authorization');
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const cronSecret = process.env.CRON_SECRET || '';
  const isVercelCron = Boolean(getHeader(req, 'x-vercel-cron'));

  const supabase = createClient(supabaseUrl, serviceKey || anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Authorization check: allow Vercel Cron (or matching CRON_SECRET), or authenticated Elanati Admin
  let authorized = false;
  if (cronSecret && bearer === cronSecret) {
    authorized = true;
  } else if (!cronSecret && isVercelCron && req.method === 'GET') {
    authorized = true;
  } else if (bearer) {
    const userClient = createClient(supabaseUrl, anonKey || serviceKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData } = await userClient.auth.getUser(bearer);
    const email = userData?.user?.email;
    if (email) {
      const { data: adminRow } = await supabase
        .from('elanati_admins')
        .select('id')
        .ilike('email', email)
        .maybeSingle();
      if (adminRow) authorized = true;
    }
  }

  if (!authorized) {
    return res.status(401).json({ error: 'غير مصرح بتشغيل الأتمتة' });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Load Automation Config
  const { data: cfgData } = await supabase
    .from('elanati_automation_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  const config = {
    auto_archive_expired: cfgData?.auto_archive_expired ?? true,
    auto_whatsapp_enabled: cfgData?.auto_whatsapp_enabled ?? false,
    free_reminder_hours_before: cfgData?.free_reminder_hours_before ?? 48,
    paid_reminder_days_before: cfgData?.paid_reminder_days_before ?? 7,
    whatsapp_provider: process.env.WHATSAPP_PROVIDER || cfgData?.whatsapp_provider || 'ultramsg',
    whatsapp_endpoint: process.env.WHATSAPP_ENDPOINT || cfgData?.whatsapp_endpoint || '',
    whatsapp_token: process.env.WHATSAPP_API_TOKEN || cfgData?.whatsapp_token || '',
    free_expiry_template:
      cfgData?.free_expiry_template ||
      `أهلاً أستاذ {الاسم}، مع حضرتك إدارة منصة إعلاناتي 👋\nإعلان حضرتك "{عنوان_الإعلان}" شافوه {المشاهدات} تاجر ومهتم حتى الآن، وهينتهي ظهوره المجاني خلال 48 ساعة.\nلو حابب يفضل إعلانك ظاهر 30 يوم كاملة في أعلى النتائج + نجمة تمييز + إمكانية إضافة 10 إعلانات وصور متعددة للمنتجات:\nتقدر تفعّل الباقة الاحترافية بـ 249 جنيه فقط عبر فودافون كاش أو إنستاباي على رقم 01007008707 وهيتفعل فوراً مع عدّاد لمتابعة اشتراكك.\nتحب أفعل لحضرتك الترقية؟`,
    paid_expiry_template:
      cfgData?.paid_expiry_template ||
      `أهلاً أستاذ {الاسم}، مع حضرتك إدارة منصة إعلاناتي 👋\nنود تذكير حضرتك بأن اشتراكك في باقة "{الباقة}" (كود {كود_الاشتراك}) سينتهي خلال {الأيام_المتبقية} أيام بتاريخ {تاريخ_الانتهاء}.\nحتى تستمر إعلاناتك ظاهرة أمام التجار بدون انقطاع، يمكنك تجديد الاشتراك عبر فودافون كاش أو إنستاباي على رقم 01007008707.\nتحب نجهز لحضرتك التجديد الآن؟`,
  };

  let archivedCount = 0;
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  // 2. Archive expired ads automatically (by ad expires_at and linked subscription expiry)
  if (config.auto_archive_expired) {
    const { data: rpcCount, error: rpcErr } = await supabase.rpc('archive_expired_elanati_ads');
    if (!rpcErr && typeof rpcCount === 'number') {
      archivedCount = rpcCount;
    } else {
      const { data: expiredAds } = await supabase
        .from('elanati_ads')
        .select('id')
        .eq('status', 'approved')
        .not('expires_at', 'is', null)
        .lte('expires_at', nowIso);

      if (expiredAds && expiredAds.length > 0) {
        const ids = expiredAds.map((a: any) => a.id);
        const { error: updErr } = await supabase
          .from('elanati_ads')
          .update({ status: 'archived', updated_at: nowIso })
          .in('id', ids);
        if (!updErr) {
          archivedCount = ids.length;
        }
      }
    }
  }

  // 3. Send automated WhatsApp notifications if enabled
  if (config.auto_whatsapp_enabled) {
    const { data: existingLogs } = await supabase
      .from('elanati_whatsapp_logs')
      .select('target_type, target_id, target_expires_at, delivery_status');

    const alreadySentSet = new Set(
      (existingLogs || [])
        .filter((l: any) => l.delivery_status === 'sent')
        .map((l: any) => `${l.target_type}:${l.target_id}:${l.target_expires_at || ''}`)
    );

    // Fetch all requests to enrich advertiser names by phone if needed
    const { data: allRequests } = await supabase
      .from('elanati_package_requests')
      .select('*')
      .order('created_at', { ascending: false });

    const phoneToName = new Map<string, string>();
    for (const r of allRequests || []) {
      const d = normalizeWhatsAppDigits(r.client_phone || '');
      if (d && r.client_name && !phoneToName.has(d)) {
        phoneToName.set(d, r.client_name);
      }
    }

    // 3a. Free Ads expiring within free_reminder_hours_before (e.g. 48 hours)
    const freeWindowEnd = new Date(
      now.getTime() + config.free_reminder_hours_before * 60 * 60 * 1000
    ).toISOString();

    const { data: expiringFreeAds } = await supabase
      .from('elanati_ads')
      .select('*')
      .eq('status', 'approved')
      .eq('package_name', 'مجاني')
      .gt('expires_at', nowIso)
      .lte('expires_at', freeWindowEnd);

    for (const ad of expiringFreeAds || []) {
      const dedupeKey = `free_ad_expiry:${ad.id}:${ad.expires_at || ''}`;
      if (alreadySentSet.has(dedupeKey)) {
        skippedCount++;
        continue;
      }

      const phoneDigits = normalizeWhatsAppDigits(ad.whatsapp || ad.contact || '');
      const clientName =
        (ad.client_name && ad.client_name.trim()) ||
        phoneToName.get(phoneDigits) ||
        'عميلنا العزيز';

      const msg = renderTemplate(config.free_expiry_template, {
        الاسم: clientName,
        عنوان_الإعلان: ad.title,
        المشاهدات: ad.views_count || 0,
        تاريخ_الانتهاء: ad.expires_at ? String(ad.expires_at).split('T')[0] : '',
      });

      const dispatch = await dispatchWhatsAppMessage({
        provider: config.whatsapp_provider,
        endpoint: config.whatsapp_endpoint,
        token: config.whatsapp_token,
        phone: ad.whatsapp || ad.contact,
        message: msg,
        metadata: {
          event: 'free_ad_expiry',
          ad_id: ad.id,
          client_name: clientName,
          ad_title: ad.title,
          views_count: ad.views_count || 0,
        },
      });

      await supabase.from('elanati_whatsapp_logs').insert({
        target_type: 'free_ad_expiry',
        target_id: ad.id,
        target_expires_at: ad.expires_at,
        client_name: clientName,
        client_phone: ad.contact,
        message_body: msg,
        delivery_status: dispatch.ok ? 'sent' : 'failed',
        provider_response: dispatch.responseText,
      });

      if (dispatch.ok) sentCount++;
      else failedCount++;
    }

    // 3b. Paid Subscriptions expiring within paid_reminder_days_before (default 7 days / 1 week)
    const paidWindowEnd = new Date(
      now.getTime() + config.paid_reminder_days_before * 24 * 60 * 60 * 1000
    ).toISOString();

    const expiringSubs = (allRequests || []).filter(
      (r: any) =>
        r.status === 'activated' &&
        r.expires_at &&
        r.expires_at > nowIso &&
        r.expires_at <= paidWindowEnd
    );

    for (const sub of expiringSubs) {
      const dedupeKey = `paid_sub_expiry:${sub.id}:${sub.expires_at || ''}`;
      if (alreadySentSet.has(dedupeKey)) {
        skippedCount++;
        continue;
      }

      const remDays = Math.max(
        1,
        Math.ceil((new Date(sub.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );
      const clientName = (sub.client_name && sub.client_name.trim()) || 'عميلنا العزيز';

      const msg = renderTemplate(config.paid_expiry_template, {
        الاسم: clientName,
        الباقة: sub.package_name,
        كود_الاشتراك: sub.subscription_code || '-',
        الأيام_المتبقية: remDays,
        تاريخ_الانتهاء: String(sub.expires_at).split('T')[0],
      });

      const dispatch = await dispatchWhatsAppMessage({
        provider: config.whatsapp_provider,
        endpoint: config.whatsapp_endpoint,
        token: config.whatsapp_token,
        phone: sub.client_phone,
        message: msg,
        metadata: {
          event: 'paid_sub_expiry',
          subscription_id: sub.id,
          subscription_code: sub.subscription_code,
          client_name: clientName,
          package_name: sub.package_name,
          remaining_days: remDays,
        },
      });

      await supabase.from('elanati_whatsapp_logs').insert({
        target_type: 'paid_sub_expiry',
        target_id: sub.id,
        target_expires_at: sub.expires_at,
        client_name: clientName,
        client_phone: sub.client_phone,
        message_body: msg,
        delivery_status: dispatch.ok ? 'sent' : 'failed',
        provider_response: dispatch.responseText,
      });

      if (dispatch.ok) sentCount++;
      else failedCount++;
    }
  }

  const summary = `أرشفة ${archivedCount} إعلان منتهي · إرسال ${sentCount} رسالة واتساب · فشل ${failedCount} · متخطى مسبقاً ${skippedCount}`;
  await supabase
    .from('elanati_automation_config')
    .update({ last_run_at: nowIso, last_run_summary: summary, updated_at: nowIso })
    .eq('id', 1);

  return res.status(200).json({
    ok: true,
    archivedCount,
    sentCount,
    failedCount,
    skippedCount,
    summary,
  });
}
