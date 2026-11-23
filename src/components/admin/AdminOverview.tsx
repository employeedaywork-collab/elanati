import { Check, Eye, Inbox, Layers, Megaphone, ShieldAlert, X } from 'lucide-react';
import { isAdExpired } from '../../services/dataService';
import { Ad, ContactMessage, PackageRequest } from '../../types';

interface AdminOverviewProps {
  ads: Ad[];
  tickets: ContactMessage[];
  packageRequests: PackageRequest[];
  openReports?: number;
  blockedAttempts?: number;
  onApproveAd: (id: string) => Promise<void>;
  onRejectAd: (id: string) => Promise<void>;
  onNavigateTab: (tab: 'ads' | 'inbox' | 'packages' | 'security') => void;
  onOpenTicket: (ticketCode: string) => void;
}

export default function AdminOverview({
  ads,
  tickets,
  packageRequests,
  openReports = 0,
  blockedAttempts = 0,
  onApproveAd,
  onRejectAd,
  onNavigateTab,
  onOpenTicket,
}: AdminOverviewProps) {
  const pendingAds = ads.filter((a) => a.status === 'pending');
  const approvedActiveAds = ads.filter((a) => a.status === 'approved' && !isAdExpired(a));
  const expiredAdsCount = ads.filter((a) => isAdExpired(a)).length;
  const totalViews = ads.reduce((acc, ad) => acc + (ad.views_count || 0), 0);
  const openTickets = tickets.filter((t) => t.status === 'new' || t.status === 'in_progress');
  const pendingPackages = packageRequests.filter((r) => r.status === 'pending');
  const confirmedEgp = packageRequests
    .filter((r) => r.status === 'activated')
    .reduce((sum, r) => sum + Number(r.price_egp || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span>الإعلانات النشطة والمعلقة</span>
            <Megaphone className="w-4 h-4 text-blue-700" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tabular-nums">
            {approvedActiveAds.length}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {pendingAds.length} بانتظار المراجعة · {expiredAdsCount} منتهي المدة
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span>تذاكر ورسائل العملاء</span>
            <Inbox className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tabular-nums">
            {openTickets.length}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            رسائل تحتاج متابعة · {tickets.length} إجمالي
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span>الاشتراكات والدفعات</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-700 tabular-nums">
            {confirmedEgp.toLocaleString('en-US')} ج.م
          </p>
          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-xs text-slate-500 tabular-nums">
              {pendingPackages.length} بانتظار التأكيد · {packageRequests.length} إجمالي
            </p>
            <button
              type="button"
              onClick={() => onNavigateTab('packages')}
              className="text-[11px] font-bold text-blue-700 hover:text-blue-900 shrink-0"
            >
              متابعة ←
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span>إجمالي مشاهدات الإعلانات</span>
            <Eye className="w-4 h-4 text-slate-700" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tabular-nums">
            {totalViews.toLocaleString('en-US')}
          </p>
          <p className="text-xs text-slate-500 mt-1">تفاعل الزوار مع العروض</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-slate-900">سجل الدخول والأمان وبلاغات الإعلانات</p>
            <p className="text-xs text-slate-500 tabular-nums">
              {blockedAttempts} محاولة تلاعب مجاني محظورة (24س) · {openReports} بلاغات إعلانات بانتظار المراجعة
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigateTab('security')}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shrink-0 self-start sm:self-auto"
        >
          فتح سجل الأمان ←
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-extrabold text-slate-900 text-base">
              إعلانات بانتظار المراجعة ({pendingAds.length})
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('ads')}
              className="text-xs font-bold text-blue-700 hover:text-blue-900"
            >
              إدارة جميع الإعلانات ←
            </button>
          </div>
          {pendingAds.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              لا توجد إعلانات معلقة للمراجعة حالياً.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingAds.slice(0, 5).map((ad) => (
                <div key={ad.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{ad.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      {ad.category} · {ad.city} · {ad.contact}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void onApproveAd(ad.id)}
                      title="اعتماد ونشر"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      اعتماد
                    </button>
                    <button
                      type="button"
                      onClick={() => void onRejectAd(ad.id)}
                      title="رفض"
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold inline-flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      رفض
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-extrabold text-slate-900 text-base">
              أحدث رسائل العملاء ({openTickets.length} مفتوحة)
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('inbox')}
              className="text-xs font-bold text-blue-700 hover:text-blue-900"
            >
              فتح مركز التواصل ←
            </button>
          </div>
          {tickets.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              لم تصل رسائل عملاء بعد.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {tickets.slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenTicket(t.ticket_code)}
                  className="w-full text-right p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">
                      {t.name} · <span className="text-blue-700 tabular-nums">{t.ticket_code}</span>
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{t.message}</p>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                      t.status === 'new'
                        ? 'bg-blue-50 text-blue-700'
                        : t.status === 'replied'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {t.status === 'new'
                      ? 'جديدة'
                      : t.status === 'in_progress'
                      ? 'قيد المتابعة'
                      : t.status === 'replied'
                      ? 'تم الرد'
                      : 'مغلقة'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
