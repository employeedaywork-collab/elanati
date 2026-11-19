import { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  Bot,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  MessageCircle,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Sparkles,
} from 'lucide-react';
import { DEFAULT_AUTOMATION_CONFIG } from '../../data/seedData';
import {
  archiveExpiredAdsAdmin,
  fetchAutomationConfigAdmin,
  fetchWhatsAppLogsAdmin,
  findPendingAutomationTargetsAdmin,
  runAutomationNowAdmin,
  updateAutomationConfigAdmin,
} from '../../services/dataService';
import {
  AutomationConfig,
  AutomationTargetPreview,
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
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadAutomation = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, pendingTargets, waLogs] = await Promise.all([
        fetchAutomationConfigAdmin(),
        findPendingAutomationTargetsAdmin(),
        fetchWhatsAppLogsAdmin(),
      ]);
      setConfig(cfg);
      setTargets(pendingTargets);
      setLogs(waLogs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAutomation();
  }, [loadAutomation]);

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await updateAutomationConfigAdmin(config);
      setConfig(saved);
      await loadAutomation();
      setFeedback({ type: 'ok', text: 'تم حفظ إعدادات الأتمتة وقوالب الرسائل بنجاح' });
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

  const handleRunAllNow = async () => {
    setRunning(true);
    setFeedback(null);
    try {
      await updateAutomationConfigAdmin(config);
      const res = await runAutomationNowAdmin();
      await Promise.all([onRefresh(), loadAutomation()]);
      setFeedback({ type: 'ok', text: res.summary });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'تعذر تشغيل دورة الأتمتة' });
    } finally {
      setRunning(false);
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
        <p className="text-sm font-bold text-slate-600">جاري تحميل مركز الأتمتة والواتساب...</p>
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

      {/* Quick Control Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-extrabold text-slate-900">
                  إزالة الإعلانات المنتهية تلقائياً
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  أرشفة كل إعلان فور انتهاء موعد باقته أو اشتراكه المسجل على المنصة
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
              يتم الفحص يومياً بشكل آلي وعند فتح لوحة التحكم
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-extrabold text-slate-900">
                  أتمتة رسائل والرد التلقائي على واتساب
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  إرسال تذكير باسم المعلن وعنوان إعلانه والمشاهدات قبل انتهاء الباقة تلقائياً
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.auto_whatsapp_enabled}
              onChange={(e) =>
                setConfig({ ...config, auto_whatsapp_enabled: e.target.checked })
              }
              className="w-5 h-5 accent-emerald-600 cursor-pointer shrink-0 mt-1"
            />
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={running}
              onClick={() => void handleRunAllNow()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-colors"
            >
              <Play className="w-4 h-4" />
              {running ? 'جاري تشغيل الأتمتة...' : 'تشغيل الإرسال والأرشفة الآن'}
            </button>

            {config.last_run_at && (
              <p className="text-[11px] text-slate-500 font-semibold">
                آخر تشغيل: {new Date(config.last_run_at).toLocaleString('ar-EG')}
              </p>
            )}
          </div>

          {config.last_run_summary && (
            <p className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2">
              {config.last_run_summary}
            </p>
          )}
        </div>
      </div>

      {/* WhatsApp Provider & Timing Settings */}
      <form onSubmit={handleSaveConfig} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-extrabold text-slate-900">إعدادات ربط الواتساب ومواعيد التنبيه</h3>
              <p className="text-xs text-slate-500">
                اربط رقم واتساب المنصة لإرسال التنبيهات والردود التلقائية بأسماء العملاء مباشرة
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'جاري الحفظ...' : 'حفظ جميع الإعدادات'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              طريقة ربط الواتساب
            </label>
            <select
              value={config.whatsapp_provider}
              onChange={(e) =>
                setConfig({
                  ...config,
                  whatsapp_provider: e.target.value as WhatsAppProvider,
                })
              }
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ultramsg">ربط رقم واتساب مباشر (UltraMsg)</option>
              <option value="meta_cloud">واتساب للأعمال الرسمي (Meta)</option>
              <option value="webhook">بوابة ربط خارجية</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              معرّف الاتصال أو رابط البوابة
            </label>
            <input
              type="text"
              dir="ltr"
              value={config.whatsapp_endpoint}
              onChange={(e) => setConfig({ ...config, whatsapp_endpoint: e.target.value })}
              placeholder={
                config.whatsapp_provider === 'ultramsg'
                  ? 'instance12345'
                  : config.whatsapp_provider === 'meta_cloud'
                  ? 'Phone Number ID'
                  : 'https://...'
              }
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-left outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            رمز الأمان الخاص بالربط
          </label>
          <div className="relative max-w-xl">
            <input
              type={showToken ? 'text' : 'password'}
              dir="ltr"
              value={config.whatsapp_token}
              onChange={(e) => setConfig({ ...config, whatsapp_token: e.target.value })}
              placeholder="أدخل مفتاح أو رمز الحماية الخاص بمزود الواتساب"
              className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs text-left outline-none focus:ring-2 focus:ring-blue-600"
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

        {/* Templates */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
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

      {/* Due Customers Preview Queue */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-slate-900">
              قائمة العملاء المستحق تنبيههم الآن ({targets.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              تُعرض هنا الأسماء وعناوين الإعلانات والمشاهدات المسجلة لكل عميل قبل انتهاء الموعد
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    إرسال مباشر عبر واتساب
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

      {/* WhatsApp Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900">
            سجل التنبيهات والردود التلقائية ({logs.length})
          </h3>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            لم يتم تسجيل رسائل واتساب تلقائية بعد.
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
