import { createClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> };

interface VercelRequestLike {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
}

interface VercelResponseLike {
  status: (code: number) => VercelResponseLike;
  send?: (body: unknown) => void;
  json: (payload: unknown) => void;
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

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  // 1. Meta WhatsApp Cloud Webhook Verification
  if (req.method === 'GET') {
    const mode = req.query?.['hub.mode'];
    const token = req.query?.['hub.verify_token'];
    const challenge = req.query?.['hub.challenge'];
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'elanati_whatsapp_verify';

    if (mode === 'subscribe' && token === verifyToken) {
      const statusRes = res.status(200);
      if (statusRes.send) {
        statusRes.send(challenge);
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

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
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
    // UltraMsg webhook payload
    incomingPhone = String(body.data.from).replace(/@c\.us$/i, '');
    senderProfileName = body.data.pushname || '';
  } else if (body?.from || body?.phone) {
    incomingPhone = String(body.from || body.phone);
    senderProfileName = body.name || '';
  }

  if (!incomingPhone) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  const cleanDigits = normalizeWhatsAppDigits(incomingPhone);
  const localPhone = cleanDigits.startsWith('201') ? cleanDigits.slice(1) : cleanDigits;

  // Find client ad & subscription in Supabase
  const [{ data: ads }, { data: subs }, { data: cfgData }] = await Promise.all([
    supabase.from('elanati_ads').select('*').order('created_at', { ascending: false }),
    supabase.from('elanati_package_requests').select('*').order('created_at', { ascending: false }),
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
  const endpoint = process.env.WHATSAPP_ENDPOINT || cfgData?.whatsapp_endpoint || '';
  const token = process.env.WHATSAPP_API_TOKEN || cfgData?.whatsapp_token || '';

  if (endpoint) {
    if (provider === 'meta_cloud') {
      const url = endpoint.startsWith('http')
        ? endpoint
        : `https://graph.facebook.com/v20.0/${endpoint}/messages`;
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
      });
    } else if (provider === 'ultramsg') {
      const url = endpoint.startsWith('http')
        ? endpoint
        : `https://api.ultramsg.com/${endpoint}/messages/chat`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token, to: `+${cleanDigits}`, body: replyText }).toString(),
      });
    } else {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: cleanDigits, message: replyText, auto_reply: true }),
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
  }

  res.status(200).json({ ok: true, replyText });
}
