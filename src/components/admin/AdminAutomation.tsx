import { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Sparkles,
} from 'lucide-react';
import { DEFAULT_AUTOMATION_CONFIG } from '../../data/seedData';
import { formatWhatsAppLink, supabase } from '../../lib/supabase';
import {
  archiveExpiredAdsAdmin,
  fetchAutomationConfigAdmin,
  fetchPendingPortalOtpsAdmin,
  fetchWhatsAppLogsAdmin,
  findPendingAutomationTargetsAdmin,
  markDirectWhatsAppSentAdmin,
  markPortalOtpSentAdmin,
  runAutomationNowAdmin,
  updateAutomationConfigAdmin,
} from '../../services/dataService';
import {
  AutomationConfig,
  AutomationTargetPreview,
  PendingPortalOtp,
  WhatsAppLog,
  WhatsAppProvider,
} from '../../types';

interface AdminAutomationProps {
  onRefresh: () => Promise<void>;
}

const LOG_TYPE_LABEL: Record<WhatsAppLog['target_type'], string> = {
  free_ad_expiry: 'تنبيه إعلان مجاني',
  paid_sub_expiry: 'تنبيه تجديد اشتراك',
  auto_reply: 'رد تلقائي على واتساب',
};

export default function AdminAutomation({ onRefresh }: AdminAutomationProps) {
  const [config, setConfig] = useState<AutomationConfig>(DEFAULT_AUTOMATION_CONFIG);
  const [targets, setTargets] = useState<AutomationTargetPreview[]>([]);
  const [pendingOtps, setPendingOtps] = useState<PendingPortalOtp[]>([]);
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [runningExternal, setRunningExternal] = useState(false);
  const [refreshingOtps, setRefreshingOtps] = useState(false);
  const [copiedOtpId, setCopiedOtpId] = useState<string | null>(null);
  const [showExternalPanel, setShowExternalPanel] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadAutomation = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, pendingTargets, waLogs, otpQueue] = await Promise.all([
        fetchAutomationConfigAdmin(),
        findPendingAutomationTargetsAdmin(),
        fetchWhatsAppLogsAdmin(),
        fetchPendingPortalOtpsAdmin(),
      ]);
      setConfig(cfg);
      setTargets(pendingTargets);
      setLogs(waLogs);
      setPendingOtps(otpQueue);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAutomation();
  }, [loadAutomation]);

  useEffect(() => {
    const poll = setInterval(() => {
      void fetchPendingPortalOtpsAdmin().then(setPendingOtps);
    }, 15000);

    const client = supabase;
    if (!client) {
      return () => {
        clearInterval(poll);
      };
    }

    const channel = client
      .channel('elanati-admin-otps-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'elanati_portal_otps' }, () => {
        void fetchPendingPortalOtpsAdmin().then(setPendingOtps);
      })
      .subscribe();
    return () => {
      clearInterval(poll);
      void client.removeChannel(channel);
    };
  }, []);

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await updateAutomationConfigAdmin(config);
      setConfig(saved);
      await loadAutomation();
      setFeedback({ type: 'ok', text: 'تم حفظ إعدادات الأتمتة والقوالب بنجاح' });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'تعذر حفظ الإعدادات' });
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveNow = async () => {
    setArchiving(true);
    setFeedback(null);
    try {
      const count = await archiveExpiredAdsAdmin();
      await Promise.all([onRefresh(), loadAutomation()]);
      setFeedback({
        type: 'ok',
        text:
          count > 0
            ? `تم إخفاء وأرشفة ${count} إعلان منتهي الصلاحية تلقائياً`
            : 'لا توجد إعلانات منتهية الصلاحية بحاجة للأرشفة حالياً',
      });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'تعذر تنفيذ الأرشفة' });
    } finally {
      setArchiving(false);
    }
  };

  const handleDirectWhatsAppSend = async (target: AutomationTargetPreview) => {
    try {
      await markDirectWhatsAppSentAdmin(target);
      await loadAutomation();
      setFeedback({
        type: 'ok',
        text: `تم فتح واتساب وتسجيل التنبيه للعميل "${target.client_name}" في السجل`,
      });
    } catch {
      // allow WhatsApp link to open regardless
    }
  };

  const handleRefreshOtps = async () => {
    setRefreshingOtps(true);
    try {
      const otpQueue = await fetchPendingPortalOtpsAdmin();
      setPendingOtps(otpQueue);
    } finally {
      setRefreshingOtps(false);
    }
  };

  const handleMarkOtpSent = async (otp: PendingPortalOtp, viaWhatsApp = false) => {
    try {
      await markPortalOtpSentAdmin(otp.id);
      setPendingOtps((prev) => prev.filter((item) => item.id !== otp.id));
      void onRefresh();
      setFeedback({
        type: 'ok',
        text: viaWhatsApp
          ? `تم فتح واتساب لإرسال رمز التحقق للرقم ${otp.phone_digits} وتحديث حالته.`
          : `تم تأكيد إرسال رمز التحقق للرقم ${otp.phone_digits}.`,
      });
    } catch {
      // allow WhatsApp link to open regardless
    }
  };

  const handleCopyOtp = async (otp: PendingPortalOtp) => {
    if (!otp.manual_otp_code || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(otp.manual_otp_code);
      setCopiedOtpId(otp.id);
      setTimeout(() => setCopiedOtpId((cur) => (cur === otp.id ? null : cur)), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const formatOtpRemaining = (expiresAt: string): string => {
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 'منتهي';
    const totalSec = Math.ceil(diffMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return mins > 0 ? `${mins} د ${secs} ث` : `${secs} ث`;
  };

  const handleRunExternalNow = async () => {
    setRunningExternal(true);
    setFeedback(null);
    try {
      await updateAutomationConfigAdmin(config);
      const res = await runAutomationNowAdmin();
      await Promise.all([onRefresh(), loadAutomation()]);
      setFeedback({ type: 'ok', text: res.summary });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'تعذر تشغيل دورة الأتمتة' });
    } finally {
      setRunningExternal(false);
    }
  };

  const appendPlaceholder = (
    field: 'free_expiry_template' | 'paid_expiry_template',
    token: string
  ) => {
    setConfig((prev) => ({
      ...prev,
      [field]: `${prev[field]}${prev[field].endsWith(' ') ? '' : ' '}${token}`,
    }));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-bold text-slate-600">جاري تحميل مركز الأتمتة والتنبيهات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-sm font-bold flex items-center justify-between gap-3 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {feedback.text}
          </span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline shrink-0"
          >
            إخفاء
          </button>
        </div>
      )}

      {/* Pending Client Portal OTPs (Zero-Cost 1-Click WhatsApp OTP Queue — Top Priority) */}
      <div
        className={`rounded-2xl border p-6 space-y-4 ${
          pendingOtps.length > 0
            ? 'bg-emerald-50/40 border-emerald-400 shadow-sm'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                pendingOtps.length > 0
                  ? 'bg-emerald-600 text-white animate-pulse'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-slate-900">
                  رموز التحقق (OTP) لواتساب العملاء ({pendingOtps.length})
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                  إرسال يدوي مجاني بضغطة زر
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                عند طلب أي عميل عرض اشتراكاته، يصلك تنبيه هنا فوراً لإرسال الرمز لرقمه عبر واتساب مباشرة (صالح لمدة 10 دقائق).
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={refreshingOtps}
            onClick={() => void handleRefreshOtps()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshingOtps ? 'animate-spin' : ''}`} />
            تحديث الطلبات
          </button>
        </div>

        {pendingOtps.length === 0 ? (
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-center text-xs font-semibold text-slate-500">
            لا توجد طلبات رموز تحقق (OTP) بانتظار الإرسال حالياً.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingOtps.map((otp) => {
              const code = otp.manual_otp_code || '';
              const waMessage = `مرحباً بك في منصة إعلاناتي 👋\nرمز التحقق (OTP) لعرض اشتراكاتك ومدفوعاتك هو: *${code}*\nصالح لمدة 10 دقائق، ولا تشاركه مع أي شخص.`;
              const waUrl = formatWhatsAppLink(otp.phone_digits, waMessage);

              return (
                <div
                  key={otp.id}
                  className="p-4 rounded-2xl border border-emerald-300 bg-white flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-900 tabular-nums" dir="ltr">
                        {otp.phone_digits.startsWith('0') ? otp.phone_digits : `+${otp.phone_digits}`}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 font-mono font-extrabold text-sm tracking-widest">
                        {code}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyOtp(otp)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold transition-colors"
                      >
                        {copiedOtpId === otp.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            تم النسخ
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            نسخ الكود
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      صالح لمدة متبقية: <strong className="text-slate-700">{formatOtpRemaining(otp.expires_at)}</strong> · طُلب في{' '}
                      {new Date(otp.created_at).toLocaleTimeString('ar-EG')}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => void handleMarkOtpSent(otp, true)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex-1 sm:flex-initial text-center"
                    >
                      <Send className="w-3.5 h-3.5 shrink-0" />
                      إرسال الكود لواتساب العميل مجاناً
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleMarkOtpSent(otp, false)}
                      className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
                    >
                      تم الإرسال
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Free In-Platform Automation Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-extrabold text-slate-900">
                    إزالة الإعلانات المنتهية تلقائياً
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                    مجاني داخل المنصة
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  أرشفة وإخفاء كل إعلان فور انتهاء موعد باقته أو اشتراكه المسجل على المنصة
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.auto_archive_expired}
              onChange={(e) =>
                setConfig({ ...config, auto_archive_expired: e.target.checked })
              }
              className="w-5 h-5 accent-blue-700 cursor-pointer shrink-0 mt-1"
            />
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={archiving}
              onClick={() => void handleArchiveNow()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${archiving ? 'animate-spin' : ''}`} />
              {archiving ? 'جاري الفحص والأرشفة...' : 'أرشفة الإعلانات المنتهية الآن'}
            </button>
            <span className="text-xs text-slate-500 font-semibold">
              يعمل تلقائياً بدون أي اشتراكات خارجية
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-extrabold text-slate-900">
                  التنبيهات والرد الآلي داخل المنصة
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                  مفعّل مجاناً
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                عند فتح العميل للموقع أو بوابة «متابعة اشتراكي» أو بدء محادثة في «تواصل مع الإدارة»، تقوم المنصة آلياً بعرض التنبيه والرد الفوري باسمه وعنوان إعلانه ومشاهداته مع أزرار الترقية والسداد.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs pt-1">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-slate-500">العملاء المستحقون حالياً</p>
              <p className="text-lg font-extrabold text-slate-900 tabular-nums mt-0.5">
                {targets.length} عميل
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-slate-500">رسائل السجل المسجلة</p>
              <p className="text-lg font-extrabold text-emerald-700 tabular-nums mt-0.5">
                {logs.length} رسالة
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Timings & Message Templates */}
      <form onSubmit={handleSaveConfig} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-extrabold text-slate-900">مواعيد التنبيه وصيغة الرسائل التلقائية</h3>
              <p className="text-xs text-slate-500">
                تُستخدم هذه الصيغ في تنبيهات المنصة، الرد التلقائي، وزر الإرسال المباشر عبر واتساب
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'جاري الحفظ...' : 'حفظ المواعيد والقوالب'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              تنبيه الإعلان المجاني قبل الانتهاء بـ (ساعة)
            </label>
            <input
              type="number"
              min={1}
              max={168}
              value={config.free_reminder_hours_before}
              onChange={(e) =>
                setConfig({
                  ...config,
                  free_reminder_hours_before: Number(e.target.value) || 48,
                })
              }
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm tabular-nums outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              تنبيه الاشتراك المدفوع قبل الانتهاء بـ (أيام)
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={config.paid_reminder_days_before}
              onChange={(e) =>
                setConfig({
                  ...config,
                  paid_reminder_days_before: Number(e.target.value) || 7,
                })
              }
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm tabular-nums outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Templates */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                رسالة تنبيه الإعلان المجاني والرد التلقائي
              </label>
              <button
                type="button"
                onClick={() =>
                  setConfig({
                    ...config,
                    free_expiry_template: DEFAULT_AUTOMATION_CONFIG.free_expiry_template,
                  })
                }
                className="text-[11px] font-bold text-blue-700 hover:underline inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                الافتراضي
              </button>
            </div>
            <textarea
              rows={7}
              value={config.free_expiry_template}
              onChange={(e) =>
                setConfig({ ...config, free_expiry_template: e.target.value })
              }
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs leading-relaxed outline-none focus:ring-2 focus:ring-blue-600"
            />
            <div className="flex flex-wrap gap-1.5">
              {['{الاسم}', '{عنوان_الإعلان}', '{المشاهدات}', '{تاريخ_الانتهاء}'].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => appendPlaceholder('free_expiry_template', chip)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-[11px] font-bold transition-colors"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                رسالة تذكير تجديد الباقات المدفوعة (قبل أسبوع)
              </label>
              <button
                type="button"
                onClick={() =>
                  setConfig({
                    ...config,
                    paid_expiry_template: DEFAULT_AUTOMATION_CONFIG.paid_expiry_template,
                  })
                }
                className="text-[11px] font-bold text-blue-700 hover:underline inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                الافتراضي
              </button>
            </div>
            <textarea
              rows={7}
              value={config.paid_expiry_template}
              onChange={(e) =>
                setConfig({ ...config, paid_expiry_template: e.target.value })
              }
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs leading-relaxed outline-none focus:ring-2 focus:ring-blue-600"
            />
            <div className="flex flex-wrap gap-1.5">
              {[
                '{الاسم}',
                '{الباقة}',
                '{كود_الاشتراك}',
                '{الأيام_المتبقية}',
                '{تاريخ_الانتهاء}',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => appendPlaceholder('paid_expiry_template', chip)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-[11px] font-bold transition-colors"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>
        </div>
      </form>

      {/* Due Customers Preview Queue (Zero-Cost 1-Click Send) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-slate-900">
              قائمة العملاء المستحق تنبيههم الآن ({targets.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              اضغط على «إرسال مباشر عبر واتساب» لفتح المحادثة بالرسالة جاهزة باسم العميل مجاناً وتوثيقها في السجل
            </p>
          </div>
        </div>

        {targets.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 text-center text-sm text-slate-500">
            لا توجد إعلانات أو اشتراكات ضمن نافذة التذكير الزمنية في الوقت الحالي.
          </div>
        ) : (
          <div className="space-y-3">
            {targets.map((t) => (
              <div
                key={`${t.target_type}:${t.target_id}`}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-900">
                        {t.client_name}
                      </span>
                      <span className="text-xs font-bold text-slate-500 tabular-nums" dir="ltr">
                        {t.client_phone}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                          t.target_type === 'free_ad_expiry'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {t.target_type === 'free_ad_expiry'
                          ? 'إعلان مجاني قرب الانتهاء'
                          : 'اشتراك مدفوع قرب التجديد'}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                          t.already_sent
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {t.already_sent ? 'تم الإرسال مسبقاً' : 'بانتظار الإرسال'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      <strong>{t.title}</strong> · المتبقي: {t.remaining_label}
                      {typeof t.views_count === 'number' && ` · المشاهدات: ${t.views_count}`}
                    </p>
                  </div>

                  <a
                    href={t.whatsapp_direct_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => void handleDirectWhatsAppSend(t)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    إرسال مباشر عبر واتساب (مجاني)
                  </a>
                </div>

                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 bg-white border border-slate-200 rounded-xl p-3.5 leading-relaxed">
                  {t.message_body}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Optional External WhatsApp Automation (Collapsed by Default) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowExternalPanel((v) => !v)}
          className="w-full px-6 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors text-right"
        >
          <div className="flex items-center gap-2.5">
            <MessageCircle className="w-5 h-5 text-slate-600" />
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                الربط الخارجي التلقائي للواتساب (اختياري مستقبلاً)
              </h3>
              <p className="text-xs text-slate-500">
                تجهيز الربط الآلي مع بوابة إرسال خارجية عند الرغبة في تفعيله لاحقاً
              </p>
            </div>
          </div>
          {showExternalPanel ? (
            <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
          )}
        </button>

        {showExternalPanel && (
          <div className="p-6 pt-2 border-t border-slate-100 space-y-4">
            <label className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <span className="text-xs font-bold text-slate-800">
                تفعيل الإرسال الآلي في الخلفية عبر مزود واتساب خارجي
              </span>
              <input
                type="checkbox"
                checked={config.auto_whatsapp_enabled}
                onChange={(e) =>
                  setConfig({ ...config, auto_whatsapp_enabled: e.target.checked })
                }
                className="w-4 h-4 accent-emerald-600"
              />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  مزود الربط
                </label>
                <select
                  value={config.whatsapp_provider}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      whatsapp_provider: e.target.value as WhatsAppProvider,
                    })
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none"
                >
                  <option value="meta_cloud">واتساب للأعمال الرسمي</option>
                  <option value="ultramsg">ربط رقم واتساب مباشر</option>
                  <option value="webhook">بوابة ربط خارجية</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  معرّف الاتصال أو رابط البوابة
                </label>
                <input
                  type="text"
                  name="wa_gateway_endpoint"
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  dir="ltr"
                  value={config.whatsapp_endpoint}
                  onChange={(e) => setConfig({ ...config, whatsapp_endpoint: e.target.value })}
                  placeholder="instance12345 أو رابط HTTPS"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-left outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رمز الأمان الخاص بالربط
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    name="wa_gateway_secret"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-form-type="other"
                    dir="ltr"
                    value={config.whatsapp_token}
                    onChange={(e) => setConfig({ ...config, whatsapp_token: e.target.value })}
                    placeholder="رمز الحماية"
                    className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-left outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    aria-label="إظهار أو إخفاء الرمز"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveConfig()}
                className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
              >
                حفظ إعدادات الربط الخارجي
              </button>
              <button
                type="button"
                disabled={runningExternal}
                onClick={() => void handleRunExternalNow()}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold"
              >
                {runningExternal ? 'جاري التشغيل...' : 'تشغيل اختبار الربط الخارجي الآن'}
              </button>
              {(config.whatsapp_endpoint || config.whatsapp_token || config.auto_whatsapp_enabled) && (
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      auto_whatsapp_enabled: false,
                      whatsapp_endpoint: '',
                      whatsapp_token: '',
                    })
                  }
                  className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold"
                >
                  تعطيل ومسح بيانات الربط
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900">
            سجل التنبيهات والردود ({logs.length})
          </h3>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            لم يتم تسجيل تنبيهات مرسلة بعد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                <tr>
                  <th className="py-3 px-4">العميل</th>
                  <th className="py-3 px-4">نوع الرسالة</th>
                  <th className="py-3 px-4">نص الرسالة</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4">التوقيت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="font-bold text-slate-900">{log.client_name}</p>
                      <p className="text-slate-500 tabular-nums" dir="ltr">
                        {log.client_phone}
                      </p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-700">
                      {LOG_TYPE_LABEL[log.target_type] || log.target_type}
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="line-clamp-2 text-slate-600">{log.message_body}</p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg font-bold ${
                          log.delivery_status === 'sent'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {log.delivery_status === 'sent' ? 'تم الإرسال' : 'تعذر الإرسال'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 tabular-nums">
                      {new Date(log.sent_at).toLocaleString('ar-EG')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
