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

export function sanitizeAdImageUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }
  return sanitizeHttpUrl(trimmed);
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

export function getGoogleMapsApiKey(): string {
  const env = import.meta.env as Record<string, unknown>;
  return (
    cleanEnvValue(env.VITE_GOOGLE_MAPS_API_KEY) ||
    cleanEnvValue(env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
  );
}

const DEVICE_ID_STORAGE_KEY = 'elanati_device_id_v1';

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && existing.length >= 16) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return 'ephemeral-device';
  }
}

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function compressAdImage(file: File): Promise<{ blob: Blob; ext: string; mimeType: string }> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error('صيغة الصورة غير مدعومة. المسموح فقط: JPG أو PNG أو WebP');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('حجم الصورة كبير جداً (الحد الأقصى 12 ميجابايت قبل الضغط)');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        URL.revokeObjectURL(objectUrl);
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            blob: file,
            ext: file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg',
            mimeType: file.type,
          });
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (webpBlob) => {
            if (webpBlob && webpBlob.size > 0 && webpBlob.size <= 4.5 * 1024 * 1024) {
              resolve({ blob: webpBlob, ext: 'webp', mimeType: 'image/webp' });
              return;
            }
            canvas.toBlob(
              (jpegBlob) => {
                if (!jpegBlob) {
                  reject(new Error('تعذر ضغط الصورة قبل الرفع'));
                  return;
                }
                resolve({ blob: jpegBlob, ext: 'jpg', mimeType: 'image/jpeg' });
              },
              'image/jpeg',
              0.82
            );
          },
          'image/webp',
          0.84
        );
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('تعذر قراءة ملف الصورة المحدد'));
    };

    img.src = objectUrl;
  });
}


