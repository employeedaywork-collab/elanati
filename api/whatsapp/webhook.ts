import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> };

interface VercelRequestLike {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
  rawBody?: string | Buffer;
}

interface VercelResponseLike {
  status: (code: number) => VercelResponseLike;
  send?: (body: unknown) => void;
  json: (payload: unknown) => void;
}

function getHeader(req: VercelRequestLike, name: string): string {
  const val = req.headers[name.toLowerCase()];
  if (Array.isArray(val)) return val[0] || '';
  return val || '';
}

function getQueryParam(req: VercelRequestLike, name: string): string {
  const val = req.query?.[name];
  if (Array.isArray(val)) return val[0] || '';
  return val || '';
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (!a || !b) return false;
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
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

  if (host === '::1' || host === '::' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
    return true;
  }

  return false;
}

function assertSafeExternalHttpsUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('Invalid external gateway URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS gateway URLs are allowed');
  }
  if (parsed.username || parsed.password || isBlockedHostname(parsed.hostname)) {
    throw new Error('Blocked external gateway address');
  }
  return parsed.toString();
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

function verifyWebhookPostAuth(req: VercelRequestLike): boolean {
  const appSecret = (process.env.WHATSAPP_APP_SECRET || '').trim();
  const signatureHeader = getHeader(req, 'x-hub-signature-256');

  if (appSecret && signatureHeader.startsWith('sha256=')) {
    const rawPayload =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : Buffer.isBuffer(req.rawBody)
        ? req.rawBody.toString('utf8')
        : JSON.stringify(req.body || {});
    const expectedSig = `sha256=${crypto
      .createHmac('sha256', appSecret)
      .update(rawPayload)
      .digest('hex')}`;
    if (timingSafeEqualStr(signatureHeader, expectedSig)) {
      return true;
    }
  }

  const webhookSecret = (
    process.env.WHATSAPP_WEBHOOK_SECRET ||
    process.env.WHATSAPP_VERIFY_TOKEN ||
    ''
  ).trim();
  if (!webhookSecret) {
    return false;
  }

  const headerSecret = getHeader(req, 'x-webhook-secret');
  const authHeader = getHeader(req, 'authorization');
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const querySecret = getQueryParam(req, 'secret') || getQueryParam(req, 'token');

  return (
    timingSafeEqualStr(headerSecret, webhookSecret) ||
    timingSafeEqualStr(bearer, webhookSecret) ||
    timingSafeEqualStr(querySecret, webhookSecret)
  );
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  // 1. Meta WhatsApp Cloud Webhook Verification
  if (req.method === 'GET') {
    const mode = getQueryParam(req, 'hub.mode');
    const token = getQueryParam(req, 'hub.verify_token');
    const challenge = getQueryParam(req, 'hub.challenge');
    const verifyToken = (process.env.WHATSAPP_VERIFY_TOKEN || '').trim();

    if (!verifyToken) {
      res.status(503).json({ error: 'Webhook verification token not configured' });
      return;
    }

    if (mode === 'subscribe' && timingSafeEqualStr(token, verifyToken)) {
      const statusRes = res.status(200);
      if (statusRes.send) {
        statusRes.send(String(challenge || ''));
        return;
      }
      statusRes.json({ challenge });
      return;
    }
    res.status(403).json({ error: 'Verification failed' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!verifyWebhookPostAuth(req)) {
    res.status(401).json({ error: 'Unauthorized webhook request' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: 'Server config missing' });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Extract incoming sender phone from Meta Cloud API, UltraMsg, or generic webhook
  const body = req.body || {};
  let incomingPhone = '';
  let senderProfileName = '';

  const metaEntry = body?.entry?.[0]?.changes?.[0]?.value;
  if (metaEntry?.messages?.[0]?.from) {
    incomingPhone = metaEntry.messages[0].from;
    senderProfileName = metaEntry.contacts?.[0]?.profile?.name || '';
  } else if (body?.data?.from) {
    incomingPhone = String(body.data.from).replace(/@c\.us$/i, '');
    senderProfileName = body.data.pushname || '';
  } else if (body?.from || body?.phone) {
    incomingPhone = String(body.from || body.phone);
    senderProfileName = body.name || '';
  }

  const cleanDigits = normalizeWhatsAppDigits(incomingPhone);
  if (!cleanDigits || cleanDigits.length < 10) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  const localPhone = cleanDigits.startsWith('201') ? cleanDigits.slice(1) : cleanDigits;

  // Find client ad & subscription in Supabase
  const [{ data: ads }, { data: subs }, { data: cfgData }] = await Promise.all([
    supabase
      .from('elanati_ads')
      .select('id, client_name, title, contact, whatsapp, views_count, expires_at, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('elanati_package_requests')
      .select('id, client_name, client_phone, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('elanati_automation_config').select('*').eq('id', 1).maybeSingle(),
  ]);

  const matchedAd = (ads || []).find((a: any) => {
    const adDigits = normalizeWhatsAppDigits(a.whatsapp || a.contact || '');
    return adDigits === cleanDigits || (a.contact || '').replace(/\D/g, '') === localPhone;
  });

  const matchedSub = (subs || []).find((s: any) => {
    const subDigits = normalizeWhatsAppDigits(s.client_phone || '');
    return subDigits === cleanDigits || (s.client_phone || '').replace(/\D/g, '') === localPhone;
  });

  const clientName =
    matchedAd?.client_name ||
    matchedSub?.client_name ||
    senderProfileName ||
    'عميلنا العزيز';

  const template =
    cfgData?.free_expiry_template ||
    `أهلاً أستاذ {الاسم}، مع حضرتك إدارة منصة إعلاناتي 👋\nإعلان حضرتك "{عنوان_الإعلان}" شافوه {المشاهدات} تاجر ومهتم حتى الآن، وهينتهي ظهوره المجاني خلال 48 ساعة.\nلو حابب يفضل إعلانك ظاهر 30 يوم كاملة في أعلى النتائج + نجمة تمييز + إمكانية إضافة 10 إعلانات وصور متعددة للمنتجات:\nتقدر تفعّل الباقة الاحترافية بـ 249 جنيه فقط عبر فودافون كاش أو إنستاباي على رقم 01007008707 وهيتفعل فوراً مع عدّاد لمتابعة اشتراكك.\nتحب أفعل لحضرتك الترقية؟`;

  const replyText = matchedAd
    ? renderTemplate(template, {
        الاسم: clientName,
        عنوان_الإعلان: matchedAd.title,
        المشاهدات: matchedAd.views_count || 0,
        تاريخ_الانتهاء: matchedAd.expires_at ? String(matchedAd.expires_at).split('T')[0] : 'دائم',
      })
    : `أهلاً أستاذ ${clientName}، مع حضرتك إدارة منصة إعلاناتي 👋\nيسعدنا خدمتك! يمكنك نشر إعلانك الأول مجاناً لمدة 7 أيام أو الاشتراك في الباقة الاحترافية (249 ج.م شهرياً) والمؤسسية (599 ج.م شهرياً) عبر فودافون كاش أو إنستاباي على رقم 01007008707.\nكيف يمكننا مساعدتك اليوم؟`;

  const provider = process.env.WHATSAPP_PROVIDER || cfgData?.whatsapp_provider || 'ultramsg';
  const endpoint = (process.env.WHATSAPP_ENDPOINT || cfgData?.whatsapp_endpoint || '').trim();
  const token = (process.env.WHATSAPP_API_TOKEN || cfgData?.whatsapp_token || '').trim();

  if (endpoint) {
    try {
      if (provider === 'meta_cloud') {
        const rawUrl = endpoint.startsWith('http')
          ? endpoint
          : `https://graph.facebook.com/v20.0/${encodeURIComponent(endpoint)}/messages`;
        const url = assertSafeExternalHttpsUrl(rawUrl);
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanDigits,
            type: 'text',
            text: { preview_url: false, body: replyText },
          }),
          signal: AbortSignal.timeout(10000),
        });
      } else if (provider === 'ultramsg') {
        const rawUrl = endpoint.startsWith('http')
          ? endpoint
          : `https://api.ultramsg.com/${encodeURIComponent(endpoint)}/messages/chat`;
        const url = assertSafeExternalHttpsUrl(rawUrl);
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token, to: `+${cleanDigits}`, body: replyText }).toString(),
          signal: AbortSignal.timeout(10000),
        });
      } else {
        const url = assertSafeExternalHttpsUrl(endpoint);
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: cleanDigits, message: replyText, auto_reply: true }),
          signal: AbortSignal.timeout(10000),
        });
      }

      await supabase.from('elanati_whatsapp_logs').insert({
        target_type: 'auto_reply',
        target_id: matchedAd?.id || matchedSub?.id || cleanDigits,
        client_name: clientName,
        client_phone: localPhone,
        message_body: replyText,
        delivery_status: 'sent',
        provider_response: 'auto_reply_webhook',
      });
    } catch {
      res.status(502).json({ error: 'Upstream WhatsApp dispatch failed' });
      return;
    }
  }

  // Never echo personalized client replyText back to HTTP caller
  res.status(200).json({ ok: true, processed: true });
}
