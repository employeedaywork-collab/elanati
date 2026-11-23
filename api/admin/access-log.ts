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
  return (getHeader(req, 'x-real-ip') || getHeader(req, 'cf-connecting-ip')).trim();
}

function maskIpHint(ip: string): string {
  const clean = ip.trim();
  if (!clean) return 'غير معروف';
  if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  }
  if (clean.includes(':')) {
    const parts = clean.split(':').filter(Boolean);
    return `${parts.slice(0, 2).join(':')}:*`;
  }
  return 'محمي';
}

function hashValue(pepper: string, scope: string, raw: string): string {
  if (!raw.trim()) return '';
  return crypto.createHash('sha256').update(`${pepper}:${scope}:${raw.trim()}`).digest('hex');
}

function maskEmail(email: string): string {
  const clean = email.trim().toLowerCase();
  const [local, domain] = clean.split('@');
  if (!domain) return clean.slice(0, 2) + '***';
  return `${(local || '').slice(0, 2)}***@${domain}`;
}

function extractBearerToken(req: VercelRequestLike): string {
  const raw = getHeader(req, 'authorization');
  if (!raw.toLowerCase().startsWith('bearer ')) return '';
  return raw.slice(7).trim();
}

function parseVisitorAgent(ua: string): string {
  const s = ua.toLowerCase();
  if (!s) return 'زائر متصفح';
  let browser = 'متصفح';
  if (s.includes('edg/')) browser = 'Edge';
  else if (s.includes('opr/') || s.includes('opera')) browser = 'Opera';
  else if (s.includes('firefox/')) browser = 'Firefox';
  else if (s.includes('chrome/') && !s.includes('edg/')) browser = 'Chrome';
  else if (s.includes('safari/') && !s.includes('chrome/')) browser = 'Safari';

  let os = 'جهاز';
  if (s.includes('iphone')) os = 'iPhone';
  else if (s.includes('ipad')) os = 'iPad';
  else if (s.includes('android')) os = 'Android';
  else if (s.includes('windows')) os = 'Windows';
  else if (s.includes('mac os') || s.includes('macintosh')) os = 'Mac';
  else if (s.includes('linux')) os = 'Linux';

  return `${browser} · ${os}`;
}

async function verifyAdminCaller(supabase: any, req: VercelRequestLike): Promise<{ email: string } | null> {
  const token = extractBearerToken(req);
  if (!token) return null;

  const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
  const user = userRes?.user;
  if (userErr || !user || !user.email || !user.email_confirmed_at) return null;

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

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'إعدادات الخادم غير مكتملة' });
  }

  const pepper = (process.env.IP_HASH_PEPPER || process.env.CRON_SECRET || serviceKey).trim();
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rawIp = extractClientIp(req);
  const ipHint = maskIpHint(rawIp);
  const ipHash = rawIp ? hashValue(pepper, 'ip', rawIp) : '';

  if (req.method === 'GET') {
    const admin = await verifyAdminCaller(supabase, req);
    if (!admin) {
      return res.status(401).json({ error: 'غير مصرح — يلزم صلاحية مدير المنصة' });
    }

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: logs, error } = await supabase
      .from('elanati_access_logs')
      .select('id, event_type, actor_label, ip_hint, reason, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(150);

    if (error) {
      return res.status(500).json({ error: 'تعذر تحميل سجل الأمان' });
    }

    const rows = logs || [];
    const failedLogins24h = rows.filter(
      (r: any) => r.event_type === 'admin_login_failed' && r.created_at >= since24h
    ).length;
    const blockedSubmits24h = rows.filter(
      (r: any) => r.event_type === 'ad_submit_blocked' && r.created_at >= since24h
    ).length;

    const siteVisits24h = rows.filter(
      (r: any) => r.event_type === 'site_visit' && r.created_at >= since24h
    ).length;

    return res.status(200).json({
      ok: true,
      logs: rows,
      summary: {
        failedLogins24h,
        blockedSubmits24h,
        siteVisits24h,
      },
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const action = String(body.action || 'login_attempt').trim();
    const rawDeviceId = String(body.deviceId || '').trim();
    const deviceHash = rawDeviceId.length >= 8 ? hashValue(pepper, 'dev', rawDeviceId) : '';

    if (action === 'site_visit') {
      const visitPath = String(body.path || '/').trim().slice(0, 100) || '/';
      const ua = getHeader(req, 'user-agent');
      const visitorAgent = parseVisitorAgent(ua);

      if (deviceHash) {
        const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        const { count: recentSameDevice } = await supabase
          .from('elanati_access_logs')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'site_visit')
          .eq('device_hash', deviceHash)
          .gte('created_at', threeMinutesAgo);

        if ((recentSameDevice || 0) > 0) {
          return res.status(200).json({ ok: true, deduplicated: true });
        }
      }

      if (ipHash) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count: hourlyVisits } = await supabase
          .from('elanati_access_logs')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'site_visit')
          .eq('ip_hash', ipHash)
          .gte('created_at', oneHourAgo);

        if ((hourlyVisits || 0) >= 30) {
          return res.status(200).json({ ok: true, throttled: true });
        }
      }

      await supabase.from('elanati_access_logs').insert({
        event_type: 'site_visit',
        actor_label: visitorAgent,
        ip_hint: ipHint,
        ip_hash: ipHash || null,
        device_hash: deviceHash || null,
        reason: `دخول زائر للمنصة (${visitPath})`,
        metadata: { source: 'public_visit', path: visitPath, agent: visitorAgent },
      });

      return res.status(200).json({ ok: true });
    }

    if (action !== 'login_attempt') {
      return res.status(400).json({ error: 'إجراء غير صالح' });
    }

    const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
    const requestedSuccess = Boolean(body.success);
    const reason = String(body.reason || '').trim().slice(0, 200);

    if (requestedSuccess) {
      const admin = await verifyAdminCaller(supabase, req);
      if (!admin) {
        return res.status(401).json({ error: 'غير مصرح بتسجيل دخول ناجح بدون جلسة موثقة' });
      }
      await supabase.from('elanati_access_logs').insert({
        event_type: 'admin_login_success',
        actor_label: maskEmail(admin.email),
        ip_hint: ipHint,
        ip_hash: ipHash || null,
        device_hash: deviceHash || null,
        reason: reason || 'تسجيل دخول ناجح للوحة المدير',
        metadata: { source: 'admin_auth' },
      });
      return res.status(200).json({ ok: true });
    }

    // Rate-limit failed login logs per IP (max 25/hour)
    if (ipHash) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('elanati_access_logs')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'admin_login_failed')
        .eq('ip_hash', ipHash)
        .gte('created_at', oneHourAgo);

      if ((count || 0) >= 25) {
        return res.status(200).json({ ok: true, throttled: true });
      }
    }

    await supabase.from('elanati_access_logs').insert({
      event_type: 'admin_login_failed',
      actor_label: email ? maskEmail(email) : 'مجهول',
      ip_hint: ipHint,
      ip_hash: ipHash || null,
      device_hash: deviceHash || null,
      reason: reason || 'محاولة دخول فاشلة للوحة المدير',
      metadata: { source: 'admin_auth' },
    });

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
