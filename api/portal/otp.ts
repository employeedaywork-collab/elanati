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

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host === 'metadata.google.internal' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^\d+$/.test(host)
  ) {
    return true;
  }

  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, o1, o2] = ipv4Match.map(Number);
    if (
      o1 === 0 ||
      o1 === 10 ||
      o1 === 127 ||
      (o1 === 169 && o2 === 254) ||
      (o1 === 172 && o2 >= 16 && o2 <= 31) ||
      (o1 === 192 && o2 === 168) ||
      (o1 === 100 && o2 >= 64 && o2 <= 127)
    ) {
      return true;
    }
  }

  if (
    host === '::1' ||
    host === '::' ||
    host.startsWith('fe80:') ||
    host.startsWith('fc') ||
    host.startsWith('fd')
  ) {
    return true;
  }

  return false;
}

function assertSafeExternalHttpsUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('رابط بوابة الواتساب غير صالح');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('يُسمح فقط بروابط HTTPS لبوابة الواتساب');
  }
  if (parsed.username || parsed.password || isBlockedHostname(parsed.hostname)) {
    throw new Error('عنوان بوابة الواتساب غير مسموح به');
  }
  return parsed.toString();
}

function normalizeLocalDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('201') && digits.length === 12) {
    return digits.slice(1);
  }
  if (digits.startsWith('00201') && digits.length === 14) {
    return digits.slice(3);
  }
  return digits;
}

function toWhatsAppDigits(localDigits: string): string {
  const digits = localDigits.replace(/\D/g, '');
  if (digits.startsWith('01') && digits.length === 11) {
    return `2${digits}`;
  }
  if (digits.startsWith('00')) {
    return digits.slice(2);
  }
  return digits;
}

function maskPhone(phoneDigits: string): string {
  const clean = normalizeLocalDigits(phoneDigits);
  if (clean.length <= 5) return '•••••';
  return `${clean.slice(0, 3)}•••••${clean.slice(-3)}`;
}

function hashValue(pepper: string, value: string): string {
  return crypto.createHash('sha256').update(`${pepper}:${value}`).digest('hex');
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

async function sendOtpViaWhatsAppGateway(params: {
  provider: string;
  endpoint: string;
  token: string;
  phoneDigits: string;
  otp: string;
}): Promise<{ ok: boolean; responseText: string }> {
  const to = toWhatsAppDigits(params.phoneDigits);
  const endpoint = params.endpoint.trim();
  const token = params.token.trim();

  if (!endpoint || !to || to.length < 10) {
    return { ok: false, responseText: 'not_configured' };
  }

  const message =
    `🔐 رمز التحقق الخاص بك للدخول إلى اشتراكاتك على منصة إعلاناتي هو:\n\n` +
    `*${params.otp}*\n\n` +
    `صالح لمدة 10 دقائق فقط. حفاظاً على خصوصية حسابك لا تشارك هذا الرمز مع أي شخص.`;

  try {
    if (params.provider === 'meta_cloud') {
      const rawUrl = endpoint.startsWith('http')
        ? endpoint
        : `https://graph.facebook.com/v20.0/${encodeURIComponent(endpoint)}/messages`;
      const url = assertSafeExternalHttpsUrl(rawUrl);
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
          text: { preview_url: false, body: message },
        }),
        signal: AbortSignal.timeout(10000),
      });
      const text = await res.text();
      return { ok: res.ok, responseText: text.slice(0, 300) };
    }

    if (params.provider === 'ultramsg') {
      const rawUrl = endpoint.startsWith('http')
        ? endpoint
        : `https://api.ultramsg.com/${encodeURIComponent(endpoint)}/messages/chat`;
      const url = assertSafeExternalHttpsUrl(rawUrl);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token, to: `+${to}`, body: message }).toString(),
        signal: AbortSignal.timeout(10000),
      });
      const text = await res.text();
      return { ok: res.ok, responseText: text.slice(0, 300) };
    }

    const url = assertSafeExternalHttpsUrl(endpoint);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'portal_otp',
        phone: to,
        message,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    return { ok: res.ok, responseText: text.slice(0, 300) };
  } catch (err: any) {
    return { ok: false, responseText: err?.message || 'gateway_error' };
  }
}

async function resolveRegisteredPhone(
  supabase: any,
  rawQuery: string
): Promise<{ phoneDigits: string; clientName: string | null } | null> {
  const clean = rawQuery.trim();
  if (!clean) return null;

  const upperCode = clean.toUpperCase();
  const digits = normalizeLocalDigits(clean);

  // Check by subscription code first
  if (upperCode.startsWith('SUB-')) {
    const { data: subByCode } = await supabase
      .from('elanati_package_requests')
      .select('client_phone, client_name')
      .ilike('subscription_code', upperCode)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subByCode?.client_phone) {
      return {
        phoneDigits: normalizeLocalDigits(subByCode.client_phone),
        clientName: subByCode.client_name || null,
      };
    }
    return null;
  }

  if (digits.length < 10) return null;

  // Match against package requests or ads
  const [{ data: reqRows }, { data: adRows }] = await Promise.all([
    supabase
      .from('elanati_package_requests')
      .select('client_phone, client_name')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('elanati_ads')
      .select('contact, client_name')
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const matchedReq = (reqRows || []).find(
    (r: any) => normalizeLocalDigits(String(r.client_phone || '')) === digits
  );
  if (matchedReq) {
    return {
      phoneDigits: digits,
      clientName: matchedReq.client_name || null,
    };
  }

  const matchedAd = (adRows || []).find(
    (a: any) => normalizeLocalDigits(String(a.contact || '')) === digits
  );
  if (matchedAd) {
    return {
      phoneDigits: digits,
      clientName: matchedAd.client_name || null,
    };
  }

  return null;
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'إعدادات الخادم غير مكتملة لتشغيل التحقق عبر OTP' });
  }

  const pepper = (process.env.CRON_SECRET || serviceKey).trim();
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = req.body || {};
  const action = String(body.action || '').trim();

  // 1) Request 6-digit OTP sent to client's registered mobile number
  if (action === 'request') {
    const query = String(body.query || '').trim();
    const resolved = await resolveRegisteredPhone(supabase, query);

    if (!resolved) {
      return res.status(404).json({
        error: 'لم نعثر على اشتراك أو إعلان مسجل بهذا الرقم أو كود الاشتراك',
      });
    }

    const { phoneDigits, clientName } = resolved;
    const tenMinAgoIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { count: recentCount } = await supabase
      .from('elanati_portal_otps')
      .select('id', { count: 'exact', head: true })
      .eq('phone_digits', phoneDigits)
      .gte('created_at', tenMinAgoIso);

    if ((recentCount || 0) >= 3) {
      return res.status(429).json({
        error: 'تم إرسال عدة رموز تحقق بالفعل، يرجى الانتظار 10 دقائق قبل طلب رمز جديد',
      });
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    const otpHash = hashValue(pepper, `${phoneDigits}:${otp}`);
    const expiresAtIso = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: cfg } = await supabase
      .from('elanati_automation_config')
      .select('whatsapp_provider, whatsapp_endpoint, whatsapp_token')
      .eq('id', 1)
      .maybeSingle();

    const provider = process.env.WHATSAPP_PROVIDER || cfg?.whatsapp_provider || 'ultramsg';
    const endpoint = (process.env.WHATSAPP_ENDPOINT || cfg?.whatsapp_endpoint || '').trim();
    const token = (process.env.WHATSAPP_API_TOKEN || cfg?.whatsapp_token || '').trim();

    let deliveryChannel = 'admin_whatsapp';
    let deliveryStatus: 'sent' | 'pending_manual' | 'failed' = 'pending_manual';

    if (endpoint && token) {
      const dispatch = await sendOtpViaWhatsAppGateway({
        provider,
        endpoint,
        token,
        phoneDigits,
        otp,
      });
      if (dispatch.ok) {
        deliveryChannel = 'whatsapp';
        deliveryStatus = 'sent';
      } else {
        deliveryChannel = 'admin_whatsapp';
        deliveryStatus = 'pending_manual';
      }
    }

    const { error: insertErr } = await supabase.from('elanati_portal_otps').insert({
      phone_digits: phoneDigits,
      otp_hash: otpHash,
      delivery_channel: deliveryChannel,
      delivery_status: deliveryStatus,
      manual_otp_code: deliveryStatus === 'pending_manual' ? otp : null,
      attempts: 0,
      expires_at: expiresAtIso,
    });

    if (insertErr) {
      return res.status(500).json({ error: 'تعذر إنشاء رمز التحقق، حاول مرة أخرى' });
    }

    return res.status(200).json({
      ok: true,
      maskedPhone: maskPhone(phoneDigits),
      clientName: clientName ? clientName.split(' ')[0] : null,
      deliveryChannel,
      expiresInMinutes: 10,
      message:
        deliveryStatus === 'sent'
          ? `تم إرسال رمز التحقق المكون من 6 أرقام إلى واتساب رقم ${maskPhone(phoneDigits)}`
          : `تم إنشاء رمز التحقق لرقم ${maskPhone(phoneDigits)} وجاري إرساله عبر واتساب المنصة`,
    });
  }

  // 2) Verify 6-digit OTP and issue short-lived 30-min portal session token
  if (action === 'verify') {
    const query = String(body.query || '').trim();
    const otp = String(body.otp || '').replace(/\D/g, '').trim();

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: 'يرجى إدخال رمز التحقق المكون من 6 أرقام' });
    }

    const resolved = await resolveRegisteredPhone(supabase, query);
    if (!resolved) {
      return res.status(401).json({ error: 'البيانات المدخلة غير صحيحة' });
    }

    const { phoneDigits } = resolved;
    const nowIso = new Date().toISOString();

    const { data: latestOtp } = await supabase
      .from('elanati_portal_otps')
      .select('*')
      .eq('phone_digits', phoneDigits)
      .is('verified_at', null)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestOtp) {
      return res.status(401).json({
        error: 'رمز التحقق غير موجود أو انتهت صلاحيته، اطلب رمزاً جديداً',
      });
    }

    if ((latestOtp.attempts || 0) >= 5) {
      return res.status(429).json({
        error: 'تم استهلاك الحد الأقصى لمحاولات التحقق، يرجى طلب رمز OTP جديد',
      });
    }

    const expectedHash = hashValue(pepper, `${phoneDigits}:${otp}`);
    const isMatch = timingSafeHexEqual(String(latestOtp.otp_hash || ''), expectedHash);

    await supabase
      .from('elanati_portal_otps')
      .update({
        attempts: (latestOtp.attempts || 0) + 1,
        ...(isMatch ? { verified_at: nowIso, manual_otp_code: null } : {}),
      })
      .eq('id', latestOtp.id);

    if (!isMatch) {
      return res.status(401).json({
        error: 'رمز التحقق غير صحيح، يرجى التأكد من الأرقام والمحاولة مجدداً',
      });
    }

    const portalToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashValue(pepper, portalToken);
    const sessionExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { error: sessErr } = await supabase.from('elanati_portal_sessions').insert({
      token_hash: tokenHash,
      phone_digits: phoneDigits,
      expires_at: sessionExpiresAt,
    });

    if (sessErr) {
      return res.status(500).json({ error: 'تعذر فتح جلسة الاشتراك، حاول مرة أخرى' });
    }

    const { data: portalData, error: portalErr } = await supabase.rpc('get_elanati_client_portal', {
      p_query: phoneDigits,
    });

    if (portalErr) {
      return res.status(500).json({ error: 'تعذر تحميل بيانات الاشتراك بعد التحقق' });
    }

    return res.status(200).json({
      ok: true,
      portalToken,
      expiresAt: sessionExpiresAt,
      maskedPhone: maskPhone(phoneDigits),
      portal: portalData || { subscription: null, payments: [], ads: [] },
    });
  }

  // 3) Fetch verified client portal using an active OTP session token
  if (action === 'fetch') {
    const portalToken = String(body.portalToken || '').trim();
    if (!portalToken || portalToken.length < 32) {
      return res.status(401).json({ error: 'يتطلب عرض الاشتراكات التحقق برمز OTP أولاً' });
    }

    const tokenHash = hashValue(pepper, portalToken);
    const nowIso = new Date().toISOString();

    const { data: sessionRow } = await supabase
      .from('elanati_portal_sessions')
      .select('phone_digits, expires_at')
      .eq('token_hash', tokenHash)
      .gt('expires_at', nowIso)
      .maybeSingle();

    if (!sessionRow) {
      return res.status(401).json({ error: 'انتهت جلسة التحقق، يرجى طلب رمز OTP جديد' });
    }

    const { data: portalData, error: portalErr } = await supabase.rpc('get_elanati_client_portal', {
      p_query: sessionRow.phone_digits,
    });

    if (portalErr) {
      return res.status(500).json({ error: 'تعذر جلب بيانات الاشتراك' });
    }

    return res.status(200).json({
      ok: true,
      maskedPhone: maskPhone(sessionRow.phone_digits),
      expiresAt: sessionRow.expires_at,
      portal: portalData || { subscription: null, payments: [], ads: [] },
    });
  }

  // 4) Logout / revoke verified portal session
  if (action === 'logout') {
    const portalToken = String(body.portalToken || '').trim();
    if (portalToken) {
      const tokenHash = hashValue(pepper, portalToken);
      await supabase.from('elanati_portal_sessions').delete().eq('token_hash', tokenHash);
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'إجراء غير صالح' });
}
