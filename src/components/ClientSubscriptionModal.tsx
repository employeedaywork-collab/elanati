import { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  Copy,
  Download,
  Eye,
  KeyRound,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  UserCheck,
  X,
} from 'lucide-react';
import { formatWhatsAppLink } from '../lib/supabase';
import {
  fetchClientPortal,
  fetchPublicAutomationTemplates,
  getRemainingDays,
  isAdExpired,
  renderWhatsAppTemplate,
} from '../services/dataService';
import { Ad, ClientPortalData, PackageRequest, SiteSettings } from '../types';

interface ClientSubscriptionModalProps {
  settings: SiteSettings;
  initialQuery?: string;
  onClose: () => void;
  onAddAd: () => void;
  onUpgrade: () => void;
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
  activated: { label: 'اشتراك نشط ومفعّل', cls: 'bg-emerald-50 text-emerald-800 border border-emerald-200' },
  cancelled: { label: 'ملغي', cls: 'bg-red-50 text-red-700 border border-red-200' },
};

export default function ClientSubscriptionModal({
  settings,
  initialQuery = '',
  onClose,
  onAddAd,
  onUpgrade,
}: ClientSubscriptionModalProps) {
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
  const [loading, setLoading] = useState(false);
  const [portal, setPortal] = useState<ClientPortalData | null>(null);
  const [searched, setSearched] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [copiedKey, setCopiedKey] = useState(false);
  const [templates, setTemplates] = useState<{
    free_reminder_hours_before: number;
    paid_reminder_days_before: number;
    free_expiry_template: string;
    paid_expiry_template: string;
  } | null>(null);

  // Live countdown ticker (1 second)
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const runSearch = async (searchText: string) => {
    const clean = searchText.trim();
    if (!clean) return;
    setLoading(true);
    setSearched(true);
    try {
      const [data, tpl] = await Promise.all([
        fetchClientPortal(clean),
        fetchPublicAutomationTemplates(),
      ]);
      setPortal(data);
      setTemplates(tpl);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (query.trim()) {
      void runSearch(query);
    }
  }, []);

  const sub: PackageRequest | null = portal?.subscription || null;
  const ads: Ad[] = portal?.ads || [];
  const totalViews = ads.reduce((sum, ad) => sum + (ad.views_count || 0), 0);
  const activeAds = ads.filter((a) => (a.status === 'approved' || a.status === 'pending') && !isAdExpired(a));

  const isFreeFallback = !sub && ads.length > 0;
  const latestFreeAd = isFreeFallback ? ads[0] : null;

  const activeStart = sub?.starts_at || latestFreeAd?.starts_at || latestFreeAd?.created_at || null;
  const activeEnd = sub?.expires_at || latestFreeAd?.expires_at || null;
  const countdown = getCountdownParts(activeEnd, nowMs);
  const progressPct = getProgressPercent(activeStart, activeEnd, nowMs);

  const isPaidActive = sub?.status === 'activated' && !countdown?.expired;
  const isEnterprise = sub?.package_name === 'المؤسسي';
  const maxQuota = sub ? (isEnterprise ? 'غير محدود' : sub.max_ads || 10) : 1;

  // Automatic personalized in-platform reminder message when approaching expiry
  let inPlatformAlert: string | null = null;
  if (templates) {
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
    const csv = '\uFEFF' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `elanati-report-${sub?.subscription_code || 'client'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm rounded-t-3xl border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">متابعة اشتراكي وتقارير الإعلانات</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              تابع تاريخ بداية ونهاية اشتراكك، العدّاد التنازلي للأيام المتبقية، وأداء إعلاناتك
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-slate-700" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch(query);
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="أدخل رقم هاتفك أو كود الاشتراك مثل SUB-12345"
                className="w-full pr-10 pl-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-xl font-bold text-sm shrink-0"
            >
              {loading ? 'جاري البحث...' : 'عرض حالة الاشتراك'}
            </button>
          </form>

          {searched && !loading && !sub && ads.length === 0 && (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <p className="font-bold text-slate-900">لم نعثر على اشتراك أو إعلانات مرتبطة بهذا الرقم أو الكود</p>
              <p className="text-xs text-slate-500">
                تأكد من كتابة رقم الهاتف الذي نشرت به إعلانك أو كود الاشتراك (SUB-XXXXX)، أو ابدأ بنشر إعلانك الآن.
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onAddAd();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-blue-700 text-white text-xs font-bold"
                >
                  أضف إعلانك الآن
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
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
                        onClose();
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
                        {sub ? `باقة ${sub.package_name}` : 'الباقة المجانية (تجربة 7 أيام)'}
                      </span>
                      {sub?.subscription_code && (
                        <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded-md tabular-nums">
                          {sub.subscription_code}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-extrabold">
                      {sub?.client_name || 'معلن على منصة إعلاناتي'}
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

                {/* Dates Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white/10 rounded-2xl p-3.5">
                    <p className="text-slate-300 flex items-center gap-1.5 mb-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-300" />
                      تاريخ البداية
                    </p>
                    <p className="font-extrabold text-sm tabular-nums">
                      {activeStart ? formatArabicDate(activeStart) : 'يبدأ فور التفعيل'}
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

                {/* Live Countdown */}
                {countdown ? (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">
                        العداد التنازلي للمدة المتبقية:
                      </span>
                      <span className="font-extrabold text-amber-400 tabular-nums">
                        {countdown.expired ? 'انتهت المدة' : `متبقي ${progressPct}% من المدة`}
                      </span>
                    </div>

                    {countdown.expired ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <p className="text-xs text-red-300">
                          انتهت صلاحية الاشتراك أو الإعلان المجاني واختفى من الواجهة العامة تلقائياً.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
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
                        طريقة السداد المختارة: {PAYMENT_METHOD_LABEL[sub.payment_method] || sub.payment_method} ({sub.price_egp} جنيه مصري)
                      </p>
                      <p className="text-slate-300 mt-0.5">
                        يبدأ العداد التنازلي فوراً بمجرد تأكيد استلام التحويل من الإدارة.
                      </p>
                    </div>
                    <a
                      href={formatWhatsAppLink(
                        settings.whatsapp_number,
                        `مرحباً إدارة إعلاناتي، أرجو تفعيل اشتراكي رقم ${sub.subscription_code} (${sub.package_name}) — رقم المرجع: ${sub.payment_reference || '-'}`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      إرسال إيصال الدفع عبر واتساب
                    </a>
                  </div>
                ) : (
                  <div className="bg-emerald-500/15 border border-emerald-400/30 rounded-2xl p-4 text-xs text-emerald-200 font-bold">
                    اشتراك المؤسسي مفعّل — إعلانات غير محدودة بظهور دائم طوال فترة الاشتراك.
                  </div>
                )}

                {sub && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 pt-1 border-t border-white/10">
                    <span>
                      الدفع بالجنيه المصري: <strong className="text-white tabular-nums">{sub.price_egp} ج.م</strong> ({PAYMENT_METHOD_LABEL[sub.payment_method] || sub.payment_method})
                    </span>
                    {sub.payment_reference && (
                      <span className="tabular-nums">مرجع العملية: {sub.payment_reference}</span>
                    )}
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
                        href={`tel:${sub?.account_manager_phone || settings.contact_phone}`}
                        className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        اتصال مباشر
                      </a>
                      <a
                        href={formatWhatsAppLink(
                          settings.whatsapp_number,
                          `مرحباً مدير الحساب، أحتاج تخطيط حملة إعلانية مخصصة لاشتراكي ${sub?.subscription_code}`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        طلب حملة مخصصة
                      </a>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
                      <KeyRound className="w-4 h-4 text-slate-700" />
                      مفتاح الربط الخاص (API Key)
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
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

              {/* Performance Report Section */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-700" />
                    <h4 className="font-extrabold text-slate-900 text-base">
                      {isPaidActive ? 'تقارير الأداء المفصلة لإعلاناتك' : 'ملخص إعلاناتك'}
                    </h4>
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
                        onClose();
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
                  <div className="bg-white rounded-xl p-3 border border-slate-200">
                    <p className="text-xs text-slate-500">إجمالي الإعلانات</p>
                    <p className="text-xl font-extrabold text-slate-900 tabular-nums mt-0.5">
                      {ads.length}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-slate-200">
                    <p className="text-xs text-slate-500">الإعلانات النشطة</p>
                    <p className="text-xl font-extrabold text-emerald-700 tabular-nums mt-0.5">
                      {activeAds.length}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-slate-200">
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
                      return (
                        <div key={ad.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate">{ad.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                              بدأ في: {formatArabicDate(ad.starts_at || ad.created_at)} ·{' '}
                              {ad.expires_at
                                ? `ينتهي في: ${formatArabicDate(ad.expires_at)}`
                                : 'ظهور دائم'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-xs font-bold tabular-nums">
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
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
