import { useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Flag,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { AccessLogEntry, AccessLogEventType, AdReport, AdReportStatus } from '../../types';

interface AdminSecurityPanelProps {
  logs: AccessLogEntry[];
  reports: AdReport[];
  onUpdateReportStatus: (id: string, status: AdReportStatus) => Promise<void>;
  onDeleteReportedAd: (adId: string, reportId: string) => Promise<void>;
  onClearOldLogs: () => Promise<void>;
}

const EVENT_META: Record<AccessLogEventType, { label: string; cls: string }> = {
  site_visit: {
    label: 'دخول للمنصة (زائر)',
    cls: 'bg-indigo-50 text-indigo-800 border border-indigo-200',
  },
  admin_login_success: {
    label: 'دخول مدير ناجح',
    cls: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  },
  admin_login_failed: {
    label: 'دخول مدير فاشل',
    cls: 'bg-red-50 text-red-700 border border-red-200',
  },
  ad_submit_ok: {
    label: 'نشر إعلان مقبول',
    cls: 'bg-blue-50 text-blue-800 border border-blue-200',
  },
  ad_submit_blocked: {
    label: 'محاولة تلاعب محظورة',
    cls: 'bg-amber-50 text-amber-900 border border-amber-300',
  },
  otp_request: {
    label: 'طلب رمز OTP',
    cls: 'bg-slate-100 text-slate-700 border border-slate-200',
  },
  ad_report: {
    label: 'بلاغ إعلان مخالف',
    cls: 'bg-rose-50 text-rose-700 border border-rose-200',
  },
};

const REPORT_STATUS_META: Record<AdReportStatus, { label: string; cls: string }> = {
  open: { label: 'مفتوح للمراجعة', cls: 'bg-red-50 text-red-700 border border-red-200' },
  reviewed: { label: 'تمت المراجعة', cls: 'bg-emerald-50 text-emerald-800 border border-emerald-200' },
  dismissed: { label: 'مرفوض / لا مخالفة', cls: 'bg-slate-100 text-slate-600 border border-slate-200' },
};

export default function AdminSecurityPanel({
  logs,
  reports,
  onUpdateReportStatus,
  onDeleteReportedAd,
  onClearOldLogs,
}: AdminSecurityPanelProps) {
  const [activeTab, setActiveTab] = useState<'logs' | 'reports'>('logs');
  const [eventFilter, setEventFilter] = useState<'all' | AccessLogEventType>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const since24h = Date.now() - 24 * 60 * 60 * 1000;
  const failedLogins24h = logs.filter(
    (l) => l.event_type === 'admin_login_failed' && new Date(l.created_at).getTime() >= since24h
  ).length;
  const blockedAttempts = logs.filter((l) => l.event_type === 'ad_submit_blocked').length;
  const acceptedAds = logs.filter((l) => l.event_type === 'ad_submit_ok').length;
  const siteVisitsCount = logs.filter((l) => l.event_type === 'site_visit').length;
  const openReportsCount = reports.filter((r) => r.status === 'open').length;

  const filteredLogs = logs.filter((l) => eventFilter === 'all' || l.event_type === eventFilter);

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.toISOString().split('T')[0]} ${d.toTimeString().slice(0, 5)}`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
            <span>دخول مدير فاشل (24س)</span>
            <KeyRound className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tabular-nums">{failedLogins24h}</p>
          <p className="text-xs text-slate-500 mt-1">مراقبة محاولات الدخول غير المصرح</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
            <span>محاولات تلاعب محظورة</span>
            <Ban className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-3xl font-extrabold text-amber-700 tabular-nums">{blockedAttempts}</p>
          <p className="text-xs text-slate-500 mt-1">تكرار مجاني عبر IP / الجهاز / الرقم</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
            <span>بلاغات إعلانات مفتوحة</span>
            <Flag className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-3xl font-extrabold text-rose-700 tabular-nums">{openReportsCount}</p>
          <p className="text-xs text-slate-500 mt-1">إجمالي البلاغات المسجلة: {reports.length}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
            <span>إعلانات موثقة مقبولة</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-700 tabular-nums">{acceptedAds}</p>
          <p className="text-xs text-slate-500 mt-1">اجتازت فحص بصمة الشبكة والحدود</p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-colors ${
              activeTab === 'logs'
                ? 'bg-blue-700 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            سجل الدخول والأمان ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-colors ${
              activeTab === 'reports'
                ? 'bg-rose-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Flag className="w-4 h-4" />
            بلاغات الإعلانات المخالفة ({openReportsCount})
          </button>
        </div>

        {activeTab === 'logs' && (
          <button
            type="button"
            disabled={cleaning}
            onClick={() => {
              setCleaning(true);
              void onClearOldLogs().finally(() => setCleaning(false));
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-500" />
            {cleaning ? 'جاري التنظيف...' : 'مسح السجلات الأقدم من 30 يوماً'}
          </button>
        )}
      </div>

      {activeTab === 'logs' ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden space-y-3">
          <div className="p-4 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                ['all', 'الكل'],
                ['site_visit', `زيارات المنصة (${siteVisitsCount})`],
                ['ad_submit_blocked', 'محاولات تلاعب محظورة'],
                ['admin_login_failed', 'دخول فاشل'],
                ['admin_login_success', 'دخول ناجح'],
                ['ad_submit_ok', 'إعلانات مقبولة'],
                ['ad_report', 'بلاغات'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setEventFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  eventFilter === key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              لا توجد أحداث مسجلة ضمن هذا التصنيف حتى الآن.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                  <tr>
                    <th className="py-3 px-4">نوع الحدث</th>
                    <th className="py-3 px-4">الفاعل / المعلن</th>
                    <th className="py-3 px-4">تلميح الشبكة</th>
                    <th className="py-3 px-4">السبب / التفاصيل</th>
                    <th className="py-3 px-4">التوقيت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredLogs.map((log) => {
                    const meta = EVENT_META[log.event_type] || {
                      label: log.event_type,
                      cls: 'bg-slate-100 text-slate-700',
                    };
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold ${meta.cls}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">
                          {log.actor_label || 'غير محدد'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap" dir="ltr">
                          {log.ip_hint || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-700 max-w-md">{log.reason || '-'}</td>
                        <td className="py-3 px-4 text-slate-500 tabular-nums whitespace-nowrap" dir="ltr">
                          {formatDateTime(log.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {reports.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              لا توجد بلاغات عن إعلانات مخالفة حالياً.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reports.map((rep) => {
                const statusMeta = REPORT_STATUS_META[rep.status] || REPORT_STATUS_META.open;
                return (
                  <div
                    key={rep.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg ${statusMeta.cls}`}>
                          {statusMeta.label}
                        </span>
                        <span className="text-xs font-extrabold text-red-700">{rep.reason}</span>
                        <span className="text-[11px] text-slate-400 tabular-nums" dir="ltr">
                          {formatDateTime(rep.created_at)}
                        </span>
                      </div>
                      <p className="text-sm font-extrabold text-slate-900">
                        الإعلان: {rep.ad_title}
                      </p>
                      {rep.details && (
                        <p className="text-xs text-slate-600 leading-relaxed">{rep.details}</p>
                      )}
                      {rep.reporter_phone && (
                        <p className="text-xs text-slate-500 tabular-nums">
                          هاتف المُبلّغ: {rep.reporter_phone}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {rep.ad_id && rep.status === 'open' && (
                        <button
                          type="button"
                          disabled={busyId === rep.id}
                          onClick={() => {
                            setBusyId(rep.id);
                            void onDeleteReportedAd(rep.ad_id!, rep.id).finally(() =>
                              setBusyId(null)
                            );
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          حذف الإعلان المخالف
                        </button>
                      )}
                      {rep.status !== 'reviewed' && (
                        <button
                          type="button"
                          disabled={busyId === rep.id}
                          onClick={() => {
                            setBusyId(rep.id);
                            void onUpdateReportStatus(rep.id, 'reviewed').finally(() =>
                              setBusyId(null)
                            );
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          تمت المراجعة
                        </button>
                      )}
                      {rep.status !== 'dismissed' && (
                        <button
                          type="button"
                          disabled={busyId === rep.id}
                          onClick={() => {
                            setBusyId(rep.id);
                            void onUpdateReportStatus(rep.id, 'dismissed').finally(() =>
                              setBusyId(null)
                            );
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          تجاهل البلاغ
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
