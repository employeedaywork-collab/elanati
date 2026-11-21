import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  Edit3,
  Eye,
  KeyRound,
  Lock,
  LogOut,
  MessageSquare,
  Phone,
  Plus,
  Receipt,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { DEFAULT_CATEGORIES } from '../data/seedData';
import { escapeCsvCell, formatWhatsAppLink, sanitizePhoneHref } from '../lib/supabase';
import {
  fetchPublicAutomationTemplates,
  fetchVerifiedClientPortal,
  getRemainingDays,
  getStoredPortalSession,
  isAdExpired,
  logoutPortalSession,
  renderWhatsAppTemplate,
  requestPortalOtp,
  verifyPortalOtp,
} from '../services/dataService';
import {
  Ad,
  ClientPortalData,
  PackageRequest,
  PortalOtpRequestResult,
  SiteSettings,
} from '../types';
import ClientEditAdModal from './ClientEditAdModal';

interface ClientPortalViewProps {
  settings: SiteSettings;
  categories?: string[];
  initialQuery?: string;
  onAddAd: () => void;
  onUpgrade: () => void;
  onCloseModal?: () => void;
  onRequestAdminEdit: (ad: Ad) => void;
  onRequestSupportTicket: (subject: string) => void;
  onAdUpdated?: () => Promise<void> | void;
}

function formatArabicDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso.split('T')[0];
  }
}

function getCountdownParts(expiresAt?: string | null, nowMs?: number) {
  if (!expiresAt) return null;
  const target = new Date(expiresAt).getTime();
  const current = nowMs ?? Date.now();
  const diff = Math.max(0, target - current);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { diff, days, hours, minutes, seconds, expired: diff === 0 };
}

function getProgressPercent(startsAt?: string | null, expiresAt?: string | null, nowMs?: number): number {
  if (!startsAt || !expiresAt) return 100;
  const start = new Date(startsAt).getTime();
  const end = new Date(expiresAt).getTime();
  const current = nowMs ?? Date.now();
  if (end <= start) return 0;
  const remaining = Math.max(0, end - current);
  return Math.min(100, Math.max(0, Math.round((remaining / (end - start)) * 100)));
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  vodafone_cash: 'فودافون كاش / محفظة إلكترونية',
  instapay: 'إنستاباي (InstaPay)',
  bank_transfer: 'تحويل بنكي',
};

const SUB_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: 'بانتظار مراجعة السداد', cls: 'bg-amber-50 text-amber-800 border border-amber-200' },
  contacted: { label: 'جاري المراجعة والتواصل', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  activated: { label: 'مدفوع ومفعّل', cls: 'bg-emerald-50 text-emerald-800 border border-emerald-200' },
  cancelled: { label: 'ملغي', cls: 'bg-red-50 text-red-700 border border-red-200' },
};

export default function ClientPortalView({
  settings,
  categories = DEFAULT_CATEGORIES,
  initialQuery = '',
  onAddAd,
  onUpgrade,
  onCloseModal,
  onRequestAdminEdit,
  onRequestSupportTicket,
  onAdUpdated,
}: ClientPortalViewProps) {
  const [query, setQuery] = useState(() => {
    if (initialQuery) return initialQuery;
    try {
      return (
        localStorage.getItem('elanati_last_sub_code') ||
        localStorage.getItem('elanati_last_client_phone') ||
        ''
      );
    } catch {
      return '';
    }
  });

  const [step, setStep] = useState<'phone' | 'otp' | 'verified'>('phone');
  const [otpInput, setOtpInput] = useState('');
  const [otpMeta, setOtpMeta] = useState<PortalOtpRequestResult | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verifiedPhoneLabel, setVerifiedPhoneLabel] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [portal, setPortal] = useState<ClientPortalData | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [copiedKey, setCopiedKey] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [templates, setTemplates] = useState<{
    free_reminder_hours_before: number;
    paid_reminder_days_before: number;
    free_expiry_template: string;
    paid_expiry_template: string;
  } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const loadVerifiedSession = useCallback(async () => {
    const existing = getStoredPortalSession();
    if (!existing) {
      setStep('phone');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const [verified, tpl] = await Promise.all([
        fetchVerifiedClientPortal(),
        fetchPublicAutomationTemplates(),
      ]);
      setPortal(verified.portal);
      setVerifiedPhoneLabel(verified.maskedPhone);
      setTemplates(tpl);
      setStep('verified');
    } catch {
      setStep('phone');
      setPortal(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVerifiedSession();
  }, [loadVerifiedSession]);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = query.trim();
    if (!clean) {
      setErrorMsg('يرجى إدخال رقم الموبايل المسجل أو كود الاشتراك');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await requestPortalOtp(clean);
      setOtpMeta(result);
      setOtpInput('');
      setResendCooldown(60);
      setStep('otp');
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر إرسال رمز التحقق');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const [verified, tpl] = await Promise.all([
        verifyPortalOtp(query, otpInput),
        fetchPublicAutomationTemplates(),
      ]);
      setPortal(verified.portal);
      setVerifiedPhoneLabel(verified.maskedPhone);
      setTemplates(tpl);
      setOtpInput('');
      setStep('verified');
    } catch (err: any) {
      setErrorMsg(err?.message || 'رمز التحقق غير صحيح');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutPortal = async () => {
    await logoutPortalSession();
    setPortal(null);
    setOtpMeta(null);
    setOtpInput('');
    setVerifiedPhoneLabel('');
    setErrorMsg('');
    setStep('phone');
  };

  const sub: PackageRequest | null = portal?.subscription || null;
  const payments: PackageRequest[] = portal?.payments || (sub ? [sub] : []);
  const ads: Ad[] = portal?.ads || [];
  const totalViews = ads.reduce((sum, ad) => sum + (ad.views_count || 0), 0);
  const activeAds = ads.filter((a) => (a.status === 'approved' || a.status === 'pending') && !isAdExpired(a));
  const totalConfirmedPaidEgp = payments
    .filter((p) => p.status === 'activated')
    .reduce((sum, p) => sum + Number(p.price_egp || 0), 0);

  const isFreeFallback = !sub && ads.length > 0;
  const latestFreeAd = isFreeFallback ? ads[0] : null;

  const activeStart = sub?.starts_at || latestFreeAd?.starts_at || latestFreeAd?.created_at || null;
  const activeEnd = sub?.expires_at || latestFreeAd?.expires_at || null;
  const countdown = getCountdownParts(activeEnd, nowMs);
  const progressPct = getProgressPercent(activeStart, activeEnd, nowMs);

  const isPaidActive = sub?.status === 'activated' && !countdown?.expired;
  const isEnterprise = sub?.package_name === 'المؤسسي';
  const maxQuota = sub ? (isEnterprise ? 'غير محدود' : sub.max_ads || 10) : 1;

  let inPlatformAlert: string | null = null;
  if (templates && step === 'verified') {
    if (sub && sub.status === 'activated' && sub.expires_at && !countdown?.expired) {
      const remMs = new Date(sub.expires_at).getTime() - nowMs;
      if (remMs > 0 && remMs <= templates.paid_reminder_days_before * 24 * 60 * 60 * 1000) {
        const remDays = Math.max(1, Math.ceil(remMs / (1000 * 60 * 60 * 24)));
        inPlatformAlert = renderWhatsAppTemplate(templates.paid_expiry_template, {
          الاسم: sub.client_name || 'عميلنا العزيز',
          الباقة: sub.package_name,
          كود_الاشتراك: sub.subscription_code || '-',
          الأيام_المتبقية: remDays,
          تاريخ_الانتهاء: sub.expires_at.split('T')[0],
        });
      }
    } else if (!sub && latestFreeAd && latestFreeAd.expires_at) {
      const remMs = new Date(latestFreeAd.expires_at).getTime() - nowMs;
      if (remMs > 0 && remMs <= templates.free_reminder_hours_before * 60 * 60 * 1000) {
        inPlatformAlert = renderWhatsAppTemplate(templates.free_expiry_template, {
          الاسم: latestFreeAd.client_name || 'عميلنا العزيز',
          عنوان_الإعلان: latestFreeAd.title,
          المشاهدات: latestFreeAd.views_count || 0,
          تاريخ_الانتهاء: latestFreeAd.expires_at.split('T')[0],
        });
      }
    }
  }

  const handleExportReport = () => {
    if (ads.length === 0) return;
    const rows = [
      ['عنوان الإعلان', 'التصنيف', 'المحافظة', 'الباقة', 'المشاهدات', 'الحالة', 'تاريخ البداية', 'تاريخ الانتهاء'],
      ...ads.map((a) => [
        a.title,
        a.category,
        a.city,
        a.package_name || 'مجاني',
        String(a.views_count || 0),
        isAdExpired(a) ? 'منتهي الصلاحية' : a.status,
        formatArabicDate(a.starts_at || a.created_at),
        a.expires_at ? formatArabicDate(a.expires_at) : 'دائم',
      ]),
    ];
    const csv = '\uFEFF' + rows.map((r) => r.map((v) => escapeCsvCell(v)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `elanati-report-${sub?.subscription_code || 'client'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Enter registered mobile or subscription code */}
      {step === 'phone' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-5 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                تحقق برمز الموبايل (OTP) لعرض اشتراكاتك الخاصة
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                حفاظاً على سرية بياناتك ودفعاتك، لا تظهر صفحة الاشتراكات إلا بعد إرسال رمز تحقق (OTP) مكون من 6 أرقام إلى رقم موبايلك المسجل وتأكيده.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          <form onSubmit={(e) => void handleRequestOtp(e)} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Smartphone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="أدخل رقم موبايلك المسجل (01xxxxxxxxx) أو كود الاشتراك"
                className="w-full pr-10 pl-4 py-3.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-sm outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-xl font-bold text-sm shrink-0 transition-colors"
            >
              {loading ? 'جاري الإرسال...' : 'إرسال رمز التحقق (OTP)'}
            </button>
          </form>

          <p className="text-[11px] text-slate-500">
            لا تشارك رمز التحقق مع أي شخص. الجلسة تبقى مفتوحة لك فقط لمدة 30 دقيقة بعد التأكيد.
          </p>
        </div>
      )}

      {/* Step 2: Enter 6-digit OTP */}
      {step === 'otp' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">أدخل رمز التحقق (OTP)</h3>
                <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                  الرقم المسجل:{' '}
                  <strong className="text-slate-900 font-mono inline-block" dir="ltr">
                    {otpMeta?.maskedPhone}
                  </strong>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setErrorMsg('');
                setOtpInput('');
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-blue-700"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              تغيير الرقم
            </button>
          </div>

          {otpMeta?.message && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold leading-relaxed space-y-2.5">
              <p>
                {otpMeta.deliveryChannel === 'whatsapp' ? (
                  <>
                    تم إرسال رمز التحقق المكون من 6 أرقام تلقائياً إلى واتساب رقم{' '}
                    <span dir="ltr" className="inline-block font-mono">
                      {otpMeta.maskedPhone}
                    </span>
                  </>
                ) : (
                  <>
                    تم تجهيز رمز التحقق للرقم{' '}
                    <span dir="ltr" className="inline-block font-mono">
                      {otpMeta.maskedPhone}
                    </span>{' '}
                    بنجاح وهو الآن جاهز للإرسال عبر واتساب الإدارة الرسمي (
                    <span dir="ltr" className="inline-block font-mono">
                      {settings.contact_phone}
                    </span>
                    ).
                  </>
                )}
              </p>
              {otpMeta.deliveryChannel === 'admin_whatsapp' && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-200/80">
                  <span className="font-medium text-emerald-800">
                    يصلك الرمز من واتساب الإدارة خلال لحظات، أو يمكنك مراسلة الإدارة الآن لاستلامه فوراً:
                  </span>
                  <a
                    href={formatWhatsAppLink(
                      settings.whatsapp_number || settings.contact_phone,
                      `مرحباً إدارة منصة إعلاناتي 👋\nطلبت رمز التحقق (OTP) للدخول إلى اشتراكاتي برقم: ${query.trim()}`
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    استلام الكود عبر واتساب المنصة
                  </a>
                </div>
              )}
            </div>
          )}

          {otpMeta?.previewOtp && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
              وضع المعاينة المحلية: رمز التحقق التجريبي هو{' '}
              <span className="font-mono text-sm tracking-widest bg-white px-2 py-0.5 rounded border border-amber-300">
                {otpMeta.previewOtp}
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          <form onSubmit={(e) => void handleVerifyOtp(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                رمز التحقق المكون من 6 أرقام
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                dir="ltr"
                className="w-full px-4 py-3.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-center text-2xl font-mono font-extrabold tracking-[0.45em] outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="submit"
                disabled={loading || otpInput.length !== 6}
                className="flex-1 py-3.5 px-6 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-colors"
              >
                {loading ? 'جاري التحقق...' : 'تأكيد الرمز وعرض اشتراكاتي'}
              </button>
              <button
                type="button"
                disabled={loading || resendCooldown > 0}
                onClick={() => void handleRequestOtp()}
                className="py-3.5 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-bold tabular-nums"
              >
                {resendCooldown > 0 ? `إعادة الإرسال بعد ${resendCooldown} ث` : 'إعادة إرسال الرمز'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step 3: Verified Private Subscriptions & Payments Portal */}
      {step === 'verified' && (
        <>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="tabular-nums">
                تم تأكيد ملكية رقمك (
                <span dir="ltr" className="inline-block font-mono">
                  {verifiedPhoneLabel}
                </span>
                ) عبر OTP — لا يرى هذه البيانات سواك
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadVerifiedSession()}
                disabled={loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-800 text-xs font-bold"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                تحديث
              </button>
              <button
                type="button"
                onClick={() => void handleLogoutPortal()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
              >
                <LogOut className="w-3.5 h-3.5" />
                إغلاق جلستي
              </button>
            </div>
          </div>

          {!loading && !sub && ads.length === 0 && (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <p className="font-bold text-slate-900">لا توجد اشتراكات أو إعلانات مسجلة لهذا الحساب حتى الآن</p>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onCloseModal?.();
                    onAddAd();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-blue-700 text-white text-xs font-bold"
                >
                  أضف إعلانك الآن
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCloseModal?.();
                    onUpgrade();
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold"
                >
                  استعرض الباقات
                </button>
              </div>
            </div>
          )}

          {(sub || isFreeFallback) && (
            <div className="space-y-6">
              {inPlatformAlert && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-extrabold text-sm text-amber-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      تنبيه تلقائي لحسابك من منصة إعلاناتي
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onCloseModal?.();
                        onUpgrade();
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold transition-colors"
                    >
                      {sub ? 'تجديد الاشتراك الآن' : 'ترقية للباقة الاحترافية (249 ج.م)'}
                    </button>
                  </div>
                  <p className="whitespace-pre-line text-xs text-slate-800 leading-relaxed bg-white/80 rounded-xl p-3.5 border border-amber-200/70">
                    {inPlatformAlert}
                  </p>
                </div>
              )}

              {/* Subscription Overview + Countdown Card */}
              <div className="rounded-3xl bg-slate-900 text-white p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-amber-300">
                        {sub ? `باقة ${sub.package_name}` : 'الباقة المجانية (تجربة 7 أيام — مرة واحدة)'}
                      </span>
                      {sub?.subscription_code && (
                        <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded-md tabular-nums">
                          {sub.subscription_code}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-extrabold">
                      {sub?.client_name || latestFreeAd?.client_name || 'معلن على منصة إعلاناتي'}
                      {sub?.company_name ? ` — ${sub.company_name}` : ''}
                    </h3>
                  </div>

                  <span
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl ${
                      sub
                        ? SUB_STATUS_LABEL[sub.status]?.cls || 'bg-slate-800 text-white'
                        : countdown?.expired
                        ? 'bg-red-100 text-red-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {sub
                      ? SUB_STATUS_LABEL[sub.status]?.label
                      : countdown?.expired
                      ? 'انتهت مدة الإعلان المجاني'
                      : 'إعلان مجاني نشط'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white/10 rounded-2xl p-3.5">
                    <p className="text-slate-300 flex items-center gap-1.5 mb-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-300" />
                      تاريخ البداية
                    </p>
                    <p className="font-extrabold text-sm tabular-nums">
                      {activeStart ? formatArabicDate(activeStart) : 'يبدأ فور تأكيد الدفع'}
                    </p>
                  </div>

                  <div className="bg-white/10 rounded-2xl p-3.5">
                    <p className="text-slate-300 flex items-center gap-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 text-amber-300" />
                      تاريخ النهاية
                    </p>
                    <p className="font-extrabold text-sm tabular-nums">
                      {sub && sub.status !== 'activated'
                        ? 'يُحدد بعد تأكيد الدفع'
                        : activeEnd
                        ? formatArabicDate(activeEnd)
                        : 'ظهور دائم'}
                    </p>
                  </div>

                  <div className="bg-white/10 rounded-2xl p-3.5">
                    <p className="text-slate-300 mb-1">رصيد الإعلانات المتاح</p>
                    <p className="font-extrabold text-sm tabular-nums">
                      {activeAds.length} مستخدم / {maxQuota}
                    </p>
                  </div>
                </div>

                {countdown ? (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">العداد التنازلي للمدة المتبقية:</span>
                      <span className="font-extrabold text-amber-400 tabular-nums">
                        {countdown.expired ? 'انتهت المدة' : `متبقي ${progressPct}% من المدة`}
                      </span>
                    </div>

                    {countdown.expired ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <p className="text-xs text-red-300">
                          انتهت صلاحية الاشتراك أو الإعلان واختفى من الواجهة العامة تلقائياً.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            onCloseModal?.();
                            onUpgrade();
                          }}
                          className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold"
                        >
                          تجديد أو ترقية الباقة الآن
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
                          {[
                            { val: countdown.days, label: 'يوم' },
                            { val: countdown.hours, label: 'ساعة' },
                            { val: countdown.minutes, label: 'دقيقة' },
                            { val: countdown.seconds, label: 'ثانية' },
                          ].map((unit) => (
                            <div key={unit.label} className="bg-slate-950/60 rounded-xl py-2.5 px-2">
                              <p className="text-xl sm:text-2xl font-extrabold text-amber-400">
                                {String(unit.val).padStart(2, '0')}
                              </p>
                              <p className="text-[11px] text-slate-300">{unit.label}</p>
                            </div>
                          ))}
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-amber-400 transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                ) : sub && sub.status !== 'activated' ? (
                  <div className="bg-amber-500/15 border border-amber-400/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-amber-200">
                        طريقة السداد المسجلة: {PAYMENT_METHOD_LABEL[sub.payment_method] || sub.payment_method} ({sub.price_egp} جنيه مصري)
                      </p>
                      <p className="text-slate-300 mt-0.5">
                        يبدأ العداد التنازلي فور مراجعة وتأكيد التحويل من إدارة المنصة.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onCloseModal?.();
                        onRequestSupportTicket(
                          `متابعة تأكيد سداد اشتراك رقم ${sub.subscription_code || ''}`
                        );
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold inline-flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      تأكيد / استفسار من الإدارة
                    </button>
                  </div>
                ) : (
                  <div className="bg-emerald-500/15 border border-emerald-400/30 rounded-2xl p-4 text-xs text-emerald-200 font-bold">
                    اشتراك المؤسسي مفعّل — إعلانات غير محدودة بظهور دائم طوال فترة الاشتراك.
                  </div>
                )}
              </div>

              {/* Subscriber Payments History (EGP) */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-700" />
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base">
                        سجل الدفعات والاشتراكات بالجنيه المصري ({payments.length})
                      </h4>
                      <p className="text-xs text-slate-500">
                        جميع عمليات السداد المسجلة على حسابك وحالة مراجعتها وتفعيلها داخل المنصة
                      </p>
                    </div>
                  </div>
                  {totalConfirmedPaidEgp > 0 && (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold tabular-nums">
                      إجمالي المؤكد: {totalConfirmedPaidEgp.toLocaleString('en-US')} ج.م
                    </span>
                  )}
                </div>

                {payments.length === 0 ? (
                  <div className="p-6 text-center space-y-2.5 text-xs text-slate-600">
                    <CreditCard className="w-7 h-7 text-slate-400 mx-auto" />
                    <p>لا توجد دفعات مالية مسجلة حتى الآن — أنت تستخدم الباقة المجانية حالياً.</p>
                    <button
                      type="button"
                      onClick={() => {
                        onCloseModal?.();
                        onUpgrade();
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold"
                    >
                      الترقية لباقة مدفوعة الآن
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <tr>
                          <th className="py-3 px-4">الكود والباقة</th>
                          <th className="py-3 px-4">المبلغ المدفوع</th>
                          <th className="py-3 px-4">وسيلة السداد والمرجع</th>
                          <th className="py-3 px-4">تاريخ الطلب / الصلاحية</th>
                          <th className="py-3 px-4">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payments.map((pay) => (
                          <tr key={pay.id} className="hover:bg-slate-50/70">
                            <td className="py-3.5 px-4">
                              <p className="font-extrabold text-slate-900">
                                {pay.package_name} ({pay.billing_cycle === 'annual' ? 'سنوي' : 'شهري'})
                              </p>
                              <p className="text-[11px] font-mono text-blue-700 mt-0.5 tabular-nums">
                                {pay.subscription_code || '—'}
                              </p>
                            </td>
                            <td className="py-3.5 px-4 font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                              {Number(pay.price_egp || 0).toLocaleString('en-US')} ج.م
                            </td>
                            <td className="py-3.5 px-4">
                              <p className="font-semibold text-slate-800">
                                {PAYMENT_METHOD_LABEL[pay.payment_method] || pay.payment_method}
                              </p>
                              <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                                مرجع: {pay.payment_reference || 'غير مسجل'}
                              </p>
                            </td>
                            <td className="py-3.5 px-4 tabular-nums">
                              <p className="text-slate-700 font-semibold">
                                {formatArabicDate(pay.created_at)}
                              </p>
                              {pay.starts_at && pay.expires_at && (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {pay.starts_at.split('T')[0]} ← {pay.expires_at.split('T')[0]}
                                </p>
                              )}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                                  SUB_STATUS_LABEL[pay.status]?.cls || 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {SUB_STATUS_LABEL[pay.status]?.label || pay.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Enterprise VIP Section */}
              {isPaidActive && isEnterprise && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/70 space-y-2">
                    <div className="flex items-center gap-2 font-extrabold text-sm text-blue-900">
                      <UserCheck className="w-4 h-4 text-blue-700" />
                      مدير حسابك الخاص
                    </div>
                    <p className="text-xs text-slate-700">
                      {sub?.account_manager_name || 'مدير حسابات الشركات - إعلاناتي'}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <a
                        href={`tel:${sanitizePhoneHref(sub?.account_manager_phone || settings.contact_phone)}`}
                        className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        اتصال مباشر
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          onCloseModal?.();
                          onRequestSupportTicket(
                            `طلب حملة مخصصة لاشتراك ${sub?.subscription_code || ''}`
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        مراسلة مدير الحساب
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                    <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
                      <KeyRound className="w-4 h-4 text-slate-700" />
                      مفتاح الربط الخاص (API Key)
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <span className="text-xs font-mono text-slate-800 truncate" dir="ltr">
                        {sub?.api_key || 'ELN-ENT-ACTIVE'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(sub?.api_key || 'ELN-ENT-ACTIVE');
                          setCopiedKey(true);
                          setTimeout(() => setCopiedKey(false), 2000);
                        }}
                        className="text-xs font-bold text-blue-700 inline-flex items-center gap-1 shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedKey ? 'تم النسخ' : 'نسخ'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Performance & One-Time Ad Edit Section */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-700" />
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base">
                        {isPaidActive ? 'إعلاناتك وتقارير الأداء' : 'إعلاناتك المسجلة'}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        يحق للمعلن تعديل كل إعلان <strong>مرة واحدة فقط</strong>؛ وأي تعديل بعد ذلك يتم عبر إدارة المنصة.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isPaidActive && ads.length > 0 && (
                      <button
                        type="button"
                        onClick={handleExportReport}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        تصدير التقرير
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onCloseModal?.();
                        onAddAd();
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      نشر إعلان جديد
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <p className="text-xs text-slate-500">إجمالي الإعلانات</p>
                    <p className="text-xl font-extrabold text-slate-900 tabular-nums mt-0.5">
                      {ads.length}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <p className="text-xs text-slate-500">الإعلانات النشطة</p>
                    <p className="text-xl font-extrabold text-emerald-700 tabular-nums mt-0.5">
                      {activeAds.length}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <p className="text-xs text-slate-500">إجمالي المشاهدات</p>
                    <p className="text-xl font-extrabold text-blue-700 tabular-nums mt-0.5">
                      {totalViews}
                    </p>
                  </div>
                </div>

                {ads.length > 0 && (
                  <div className="divide-y divide-slate-200 bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {ads.map((ad) => {
                      const remDays = getRemainingDays(ad.expires_at);
                      const expired = isAdExpired(ad);
                      const usedEdit = (ad.client_edits_count || 0) >= 1;

                      return (
                        <div key={ad.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-slate-900 text-sm truncate">{ad.title}</p>
                              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                                {ad.category}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 tabular-nums">
                              بدأ في: {formatArabicDate(ad.starts_at || ad.created_at)} ·{' '}
                              {ad.expires_at
                                ? `ينتهي في: ${formatArabicDate(ad.expires_at)}`
                                : 'ظهور دائم'}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs font-bold tabular-nums">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                              <Eye className="w-3.5 h-3.5" />
                              {ad.views_count}
                            </span>
                            <span
                              className={`px-2.5 py-1 rounded-lg ${
                                expired
                                  ? 'bg-red-50 text-red-700'
                                  : remDays === null
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : remDays <= 2
                                  ? 'bg-amber-50 text-amber-800'
                                  : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {expired
                                ? 'منتهي الصلاحية'
                                : remDays === null
                                ? 'دائم'
                                : `متبقي ${remDays} يوم`}
                            </span>

                            {!usedEdit ? (
                              <button
                                type="button"
                                onClick={() => setEditingAd(ad)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                تعديل الإعلان (مرة واحدة)
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  onCloseModal?.();
                                  onRequestAdminEdit(ad);
                                }}
                                title="تم استخدام التعديل المتاح للمعلن (1/1) — اضغط لطلب تعديل عبر الإدارة"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 transition-colors"
                              >
                                <Lock className="w-3.5 h-3.5 text-amber-600" />
                                طلب تعديل عبر الإدارة
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {editingAd && (
        <ClientEditAdModal
          ad={editingAd}
          ownerQuery={sub?.subscription_code || query}
          categories={categories}
          onClose={() => setEditingAd(null)}
          onSaved={async () => {
            await loadVerifiedSession();
            await onAdUpdated?.();
          }}
        />
      )}
    </div>
  );
}
