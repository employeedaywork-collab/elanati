import { createClient } from '@supabase/supabase-js';
import * as webpushModule from 'web-push';

const webpush = (
  (webpushModule as unknown as { default?: typeof webpushModule }).default || webpushModule
) as typeof webpushModule;

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
    host.includes(':') &&
    (host === '::1' ||
      host === '::' ||
      host.startsWith('::ffff:') ||
      /^fe[89ab][0-9a-f]?:/i.test(host) ||
      /^f[cd][0-9a-f]{0,2}:/i.test(host))
  ) {
    return true;
  }

  return false;
}

function assertValidPushEndpoint(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('رابط اشتراك الإشعارات غير صالح');
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    (parsed.port && parsed.port !== '443') ||
    isBlockedHostname(parsed.hostname)
  ) {
    throw new Error('نطاق اشتراك الإشعارات غير مسموح به');
  }
  return parsed.toString();
}

function extractBearerToken(req: VercelRequestLike): string {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader || '';
  if (!raw.toLowerCase().startsWith('bearer ')) return '';
  return raw.slice(7).trim();
}

async function verifyAdminCaller(supabase: any, req: VercelRequestLike): Promise<{ email: string } | null> {
  const token = extractBearerToken(req);
  if (!token) return null;

  const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
  const user = userRes?.user;
  if (userErr || !user || !user.email || !user.email_confirmed_at) {
    return null;
  }

  const email = user.email.trim().toLowerCase();
  let { data: adminRow } = await supabase
    .from('elanati_admins')
    .select('id, email, user_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!adminRow) {
    const byEmail = await supabase
      .from('elanati_admins')
      .select('id, email, user_id')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();
    adminRow = byEmail.data;
  }

  if (!adminRow) return null;
  if (adminRow.user_id && adminRow.user_id !== user.id) return null;

  return { email: String(adminRow.email || email).toLowerCase() };
}

async function getOrCreateVapidKeys(supabase: any): Promise<{
  publicKey: string;
  privateKey: string;
  subject: string;
}> {
  const envPublic = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const envPrivate = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const envSubject = (process.env.VAPID_SUBJECT || 'mailto:admin@elanati.app').trim();

  if (envPublic && envPrivate) {
    return { publicKey: envPublic, privateKey: envPrivate, subject: envSubject };
  }

  const { data: existing } = await supabase
    .from('elanati_push_vapid_keys')
    .select('public_key, private_key, subject')
    .eq('id', 1)
    .maybeSingle();

  if (existing?.public_key && existing?.private_key) {
    return {
      publicKey: String(existing.public_key),
      privateKey: String(existing.private_key),
      subject: String(existing.subject || envSubject),
    };
  }

  const generated = webpush.generateVAPIDKeys();
  const { error: upsertErr } = await supabase
    .from('elanati_push_vapid_keys')
    .upsert(
      {
        id: 1,
        public_key: generated.publicKey,
        private_key: generated.privateKey,
        subject: envSubject,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );

  if (upsertErr) {
    throw new Error('يرجى تشغيل أحدث ملف supabase/schema.sql لإنشاء جداول إشعارات Web Push أولاً');
  }

  const { data: persisted } = await supabase
    .from('elanati_push_vapid_keys')
    .select('public_key, private_key, subject')
    .eq('id', 1)
    .maybeSingle();

  return {
    publicKey: String(persisted?.public_key || generated.publicKey),
    privateKey: String(persisted?.private_key || generated.privateKey),
    subject: String(persisted?.subject || envSubject),
  };
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'إعدادات الخادم غير مكتملة لتشغيل إشعارات Web Push' });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const admin = await verifyAdminCaller(supabase, req);
  if (!admin) {
    return res.status(401).json({ error: 'غير مصرح — يرجى تسجيل الدخول بحساب مدير المنصة' });
  }

  try {
    const vapid = await getOrCreateVapidKeys(supabase);

    if (req.method === 'GET') {
      const { count } = await supabase
        .from('elanati_admin_push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('admin_email', admin.email);

      return res.status(200).json({
        ok: true,
        publicKey: vapid.publicKey,
        subscriptionCount: count || 0,
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = req.body || {};
    const action = String(body.action || '').trim();

    if (action === 'subscribe') {
      const sub = body.subscription || {};
      const endpoint = assertValidPushEndpoint(String(sub.endpoint || ''));
      const p256dh = String(sub.keys?.p256dh || '').trim();
      const auth = String(sub.keys?.auth || '').trim();

      if (!p256dh || !auth || p256dh.length > 512 || auth.length > 512) {
        return res.status(400).json({ error: 'بيانات اشتراك إشعارات المتصفح غير مكتملة' });
      }

      const uaHeader = req.headers['user-agent'];
      const userAgent = (Array.isArray(uaHeader) ? uaHeader[0] : uaHeader || '').slice(0, 250);

      const { error: upsertErr } = await supabase
        .from('elanati_admin_push_subscriptions')
        .upsert(
          {
            admin_email: admin.email,
            endpoint,
            p256dh,
            auth,
            user_agent: userAgent,
            last_used_at: new Date().toISOString(),
          },
          { onConflict: 'endpoint' }
        );

      if (upsertErr) {
        return res.status(500).json({ error: 'تعذر حفظ اشتراك إشعارات الموبايل' });
      }

      return res.status(200).json({ ok: true });
    }

    if (action === 'unsubscribe') {
      const endpoint = String(body.endpoint || '').trim();
      if (endpoint) {
        await supabase
          .from('elanati_admin_push_subscriptions')
          .delete()
          .eq('endpoint', endpoint)
          .eq('admin_email', admin.email);
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'test') {
      webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
      const { data: subs } = await supabase
        .from('elanati_admin_push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('admin_email', admin.email);

      if (!subs || subs.length === 0) {
        return res.status(400).json({
          error: 'لا يوجد جهاز مسجل بعد. اضغط «تفعيل إشعارات الموبايل» أولاً.',
        });
      }

      let sent = 0;
      const expiredIds: string[] = [];
      const payload = JSON.stringify({
        title: '🔔 تجربة إشعار الموبايل — إعلاناتي',
        body: 'تم الربط بنجاح! ستصلك تنبيهات طلبات رموز OTP هنا حتى عند إغلاق المتصفح.',
        tag: 'elanati-push-test',
        url: '/admin/automation',
      });

      await Promise.all(
        subs.map(async (row: any) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: row.endpoint,
                keys: { p256dh: row.p256dh, auth: row.auth },
              },
              payload,
              { TTL: 120 }
            );
            sent += 1;
          } catch (err: any) {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              expiredIds.push(row.id);
            }
          }
        })
      );

      if (expiredIds.length > 0) {
        await supabase
          .from('elanati_admin_push_subscriptions')
          .delete()
          .in('id', expiredIds);
      }

      if (sent === 0) {
        return res.status(502).json({
          error: 'تعذر توصيل الإشعار التجريبي للجهاز، يرجى إعادة تفعيل الإشعارات.',
        });
      }

      return res.status(200).json({ ok: true, sent });
    }

    return res.status(400).json({ error: 'إجراء غير معروف' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'حدث خطأ في خدمة إشعارات الموبايل' });
  }
}
