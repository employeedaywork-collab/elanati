import { createClient, SupabaseClient } from '@supabase/supabase-js';

function cleanEnvValue(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

const rawUrl =
  cleanEnvValue(import.meta.env.VITE_SUPABASE_URL) ||
  cleanEnvValue((import.meta.env as Record<string, unknown>).NEXT_PUBLIC_SUPABASE_URL);

function parseSupabaseUrl(input: string): {
  origin: string;
  host: string;
  hadExtraPath: boolean;
  isDashboardUrl: boolean;
  valid: boolean;
} {
  if (!input || input.includes('YOUR_PROJECT_REF')) {
    return { origin: '', host: '', hadExtraPath: false, isDashboardUrl: false, valid: false };
  }
  try {
    const parsed = new URL(input);
    const isHttps = parsed.protocol === 'https:';
    const isDashboardUrl = parsed.host === 'supabase.com' || parsed.host === 'app.supabase.com';
    const hadExtraPath = parsed.pathname !== '/' && parsed.pathname !== '';
    return {
      origin: parsed.origin,
      host: parsed.host,
      hadExtraPath,
      isDashboardUrl,
      valid: isHttps && !isDashboardUrl,
    };
  } catch {
    return { origin: '', host: '', hadExtraPath: false, isDashboardUrl: false, valid: false };
  }
}

const urlInfo = parseSupabaseUrl(rawUrl);
const supabaseUrl = urlInfo.origin;

const supabaseAnonKey =
  cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  cleanEnvValue((import.meta.env as Record<string, unknown>).NEXT_PUBLIC_SUPABASE_ANON_KEY);

const hasRealKey = Boolean(
  supabaseAnonKey &&
    !supabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY')
);

const keyLooksLikeSecret = supabaseAnonKey.startsWith('sb_secret_');

export const isSupabaseConfigured = Boolean(urlInfo.valid && hasRealKey && !keyLooksLikeSecret);

export const supabaseConfigDiagnostics = {
  hasUrl: Boolean(rawUrl),
  urlValid: urlInfo.valid,
  hadExtraPath: urlInfo.hadExtraPath,
  isDashboardUrl: urlInfo.isDashboardUrl,
  hasKey: Boolean(supabaseAnonKey),
  keyValid: hasRealKey && !keyLooksLikeSecret,
  keyLooksLikeSecret,
  projectHost: urlInfo.host,
};

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export function formatWhatsAppLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, '');
  let normalized = digits;
  if (digits.startsWith('01') && digits.length === 11) {
    normalized = `2${digits}`;
  } else if (digits.startsWith('00')) {
    normalized = digits.slice(2);
  }
  const base = `https://wa.me/${normalized}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function sanitizeHttpUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
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

export function sanitizePhoneHref(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return '';
  const cleaned = phone.trim().replace(/[^+\d]/g, '');
  return cleaned.startsWith('+')
    ? `+${cleaned.slice(1).replace(/\+/g, '')}`
    : cleaned.replace(/\+/g, '');
}

export function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  const neutralized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export function isPreviewAuthAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.run.app') ||
    host.endsWith('.webcontainer.io') ||
    host.endsWith('.googleusercontent.com') ||
    host.endsWith('.aistudio.google.com')
  );
}

