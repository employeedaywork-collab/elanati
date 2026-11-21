import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  MessageCircle,
  Save,
  Search,
  Users,
  X,
} from 'lucide-react';
import { formatWhatsAppLink } from '../../lib/supabase';
import {
  activateSubscriptionAdmin,
  extendSubscriptionAdmin,
  getRemainingDays,
  updatePackageAdmin,
  updatePackageRequestAdmin,
} from '../../services/dataService';
import { PackagePlan, PackageRequest, PackageRequestStatus } from '../../types';

interface AdminPackagesManagerProps {
  requests: PackageRequest[];
  packages: PackagePlan[];
  onRefresh: () => Promise<void>;
}

const REQ_STATUS: Record<PackageRequestStatus, { label: string; cls: string }> = {
  pending: { label: 'بانتظار التأكيد', cls: 'bg-amber-50 text-amber-800 border border-amber-200' },
  contacted: { label: 'تم التواصل', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  activated: { label: 'مدفوع ومفعّل', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  cancelled: { label: 'ملغي', cls: 'bg-slate-100 text-slate-600 border border-slate-200' },
};

const PAYMENT_LABEL: Record<string, string> = {
  vodafone_cash: 'فودافون كاش',
  instapay: 'إنستاباي',
  bank_transfer: 'تحويل بنكي',
};

type SubFilterTab = 'all' | 'pending' | 'active' | 'expiring' | 'ended';

export default function AdminPackagesManager({
  requests,
  packages,
  onRefresh,
}: AdminPackagesManagerProps) {
  const [editingPlans, setEditingPlans] = useState<Record<string, PackagePlan>>({});
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [busyReqId, setBusyReqId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<SubFilterTab>('all');
  const [editingReq, setEditingReq] = useState<PackageRequest | null>(null);
  const [reqEditRef, setReqEditRef] = useState('');
  const [reqEditNote, setReqEditNote] = useState('');

  const stats = useMemo(() => {
    let confirmedRevenueEgp = 0;
    let pendingCount = 0;
    let activeCount = 0;
    let expiringSoonCount = 0;

    for (const r of requests) {
      if (r.status === 'activated') {
        confirmedRevenueEgp += Number(r.price_egp || 0);
        const rem = getRemainingDays(r.expires_at);
        if (rem === null || rem > 0) {
          activeCount += 1;
        }
        if (rem !== null && rem > 0 && rem <= 7) {
          expiringSoonCount += 1;
        }
      } else if (r.status === 'pending' || r.status === 'contacted') {
        pendingCount += 1;
      }
    }

    return { confirmedRevenueEgp, pendingCount, activeCount, expiringSoonCount };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      const rem = getRemainingDays(r.expires_at);
      const isExpiredSub = r.status === 'activated' && rem === 0;
      const isActiveSub = r.status === 'activated' && (rem === null || rem > 0);
      const isExpiringSoon = r.status === 'activated' && rem !== null && rem > 0 && rem <= 7;

      const matchesTab =
        filterTab === 'all'
          ? true
          : filterTab === 'pending'
          ? r.status === 'pending' || r.status === 'contacted'
          : filterTab === 'active'
          ? isActiveSub
          : filterTab === 'expiring'
          ? isExpiringSoon
          : r.status === 'cancelled' || isExpiredSub;

      const matchesSearch =
        !q ||
        r.client_name.toLowerCase().includes(q) ||
        r.client_phone.includes(q) ||
        (r.subscription_code || '').toLowerCase().includes(q) ||
        (r.payment_reference || '').toLowerCase().includes(q) ||
        (r.company_name || '').toLowerCase().includes(q);

      return matchesTab && matchesSearch;
    });
  }, [requests, filterTab, search]);

  const handleRequestStatus = async (req: PackageRequest, status: PackageRequestStatus) => {
    setBusyReqId(req.id);
    try {
      if (status === 'activated') {
        await activateSubscriptionAdmin(req);
      } else {
        await updatePackageRequestAdmin(req.id, { status });
      }
      await onRefresh();
    } finally {
      setBusyReqId(null);
    }
  };

  const handleActivateNow = async (req: PackageRequest) => {
    setBusyReqId(req.id);
    try {
      await activateSubscriptionAdmin(req);
      await onRefresh();
    } finally {
      setBusyReqId(null);
    }
  };

  const handleExtend = async (req: PackageRequest, extraDays: number) => {
    setBusyReqId(req.id);
    try {
      await extendSubscriptionAdmin(req, extraDays);
      await onRefresh();
    } finally {
      setBusyReqId(null);
    }
  };

  const openEditRequest = (req: PackageRequest) => {
    setEditingReq(req);
    setReqEditRef(req.payment_reference || '');
    setReqEditNote(req.admin_note || '');
  };

  const handleSaveRequestNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReq) return;
    setBusyReqId(editingReq.id);
    try {
      await updatePackageRequestAdmin(editingReq.id, {
        payment_reference: reqEditRef.trim() || null,
        admin_note: reqEditNote.trim() || null,
      });
      setEditingReq(null);
      await onRefresh();
    } finally {
      setBusyReqId(null);
    }
  };

  const handleExportPaymentsCsv = () => {
    if (filteredRequests.length === 0) return;
    const rows = [
      [
        'كود الاشتراك',
        'اسم المشترك',
        'رقم الهاتف',
        'النشاط / الشركة',
        'الباقة',
        'الدورة',
        'المبلغ (ج.م)',
        'وسيلة السداد',
        'مرجع الدفع',
        'الحالة',
        'تاريخ البداية',
        'تاريخ النهاية',
        'ملاحظات الإدارة',
      ],
      ...filteredRequests.map((r) => [
        r.subscription_code || '-',
        r.client_name,
        r.client_phone,
        r.company_name || '-',
        r.package_name,
        r.billing_cycle === 'annual' ? 'سنوي' : 'شهري',
        String(r.price_egp || 0),
        PAYMENT_LABEL[r.payment_method] || r.payment_method,
        r.payment_reference || '-',
        REQ_STATUS[r.status]?.label || r.status,
        r.starts_at ? r.starts_at.split('T')[0] : '-',
        r.expires_at ? r.expires_at.split('T')[0] : '-',
        r.admin_note || '-',
      ]),
    ];
    const csv = '\uFEFF' + rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elanati-subscriptions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getPlanDraft = (pkg: PackagePlan) => editingPlans[pkg.id] || pkg;

  const updateDraft = (pkg: PackagePlan, patch: Partial<PackagePlan>) => {
    setEditingPlans((prev) => ({
      ...prev,
      [pkg.id]: { ...getPlanDraft(pkg), ...patch },
    }));
  };

  const savePlan = async (pkg: PackagePlan) => {
    const draft = getPlanDraft(pkg);
    setSavingPlanId(pkg.id);
    try {
      await updatePackageAdmin(pkg.id, {
        name: draft.name,
        monthly_price: Number(draft.monthly_price),
        annual_price: Number(draft.annual_price),
        description: draft.description,
        popular: draft.popular,
        is_active: draft.is_active,
        cta_label: draft.cta_label,
      });
      await onRefresh();
    } finally {
      setSavingPlanId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Financial & Subscriptions Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
            <span>إجمالي الدفعات المؤكدة</span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-700 tabular-nums">
            {stats.confirmedRevenueEgp.toLocaleString('en-US')} ج.م
          </p>
          <p className="text-[11px] text-slate-500 mt-1">مبالغ الاشتراكات المفعّلة</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
            <span>طلبات بانتظار المراجعة</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
            {stats.pendingCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">دفعات قيد التأكيد والتفعيل</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
            <span>اشتراكات نشطة حالياً</span>
            <Users className="w-4 h-4 text-blue-700" />
          </div>
          <p className="text-2xl font-extrabold text-blue-700 tabular-nums">
            {stats.activeCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">تظهر إعلاناتهم بالواجهة العامة</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
            <span>تنتهي خلال 7 أيام</span>
            <AlertCircle className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-extrabold text-red-600 tabular-nums">
            {stats.expiringSoonCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">تحتاج متابعة وتجديد قريب</p>
        </div>
      </div>

      {/* Subscriptions & Payments Tracking Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="font-extrabold text-slate-900 text-base">
              متابعة الاشتراكات وسجل الدفعات بالجنيه المصري ({filteredRequests.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              راقب مدة كل مشترك، وسيلة السداد ومرجع التحويل، وجدّد أو مدّد الاشتراك بضغطة واحدة
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportPaymentsCsv}
            disabled={filteredRequests.length === 0}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-xs font-bold text-slate-700 shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            تصدير سجل الدفعات
          </button>
        </div>

        <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-100 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم، الهاتف، كود الاشتراك، أو مرجع التحويل..."
              className="w-full pr-10 pl-4 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {(
              [
                ['all', 'الكل'],
                ['pending', 'بانتظار التأكيد'],
                ['active', 'نشط ومفعّل'],
                ['expiring', 'قارب على الانتهاء'],
                ['ended', 'منتهي / ملغي'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilterTab(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  filterTab === key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            لا توجد اشتراكات أو دفعات مطابقة لخيار البحث الحالي.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                <tr>
                  <th className="py-3.5 px-4">المشترك / الكود</th>
                  <th className="py-3.5 px-4">الباقة والدفعة المالية</th>
                  <th className="py-3.5 px-4">مدة الاشتراك والانتهاء</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4">المتابعة والتمديد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => {
                  const remDays = getRemainingDays(req.expires_at);
                  const isExpiringSoon = req.status === 'activated' && remDays !== null && remDays > 0 && remDays <= 7;
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{req.client_name}</p>
                        <p className="text-xs font-bold text-slate-700 tabular-nums">
                          {req.client_phone}
                          {req.subscription_code ? ` · ${req.subscription_code}` : ''}
                        </p>
                        {req.company_name && (
                          <p className="text-xs text-slate-500">{req.company_name}</p>
                        )}
                        {req.admin_note && (
                          <p className="text-[11px] text-blue-700 mt-0.5 truncate max-w-[200px]">
                            ملاحظة: {req.admin_note}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                        <p className="font-bold text-blue-700">
                          {req.package_name} ({req.billing_cycle === 'annual' ? 'سنوي' : 'شهري'})
                        </p>
                        <p className="font-extrabold text-slate-900 tabular-nums mt-0.5">
                          {Number(req.price_egp || 0).toLocaleString('en-US')} ج.م · {PAYMENT_LABEL[req.payment_method] || req.payment_method}
                        </p>
                        <p className="text-[11px] text-slate-500 tabular-nums">
                          مرجع: {req.payment_reference || 'غير مسجل'}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs tabular-nums">
                        {req.starts_at && req.expires_at ? (
                          <div>
                            <p className="text-slate-700 font-semibold">
                              من {req.starts_at.split('T')[0]} ← {req.expires_at.split('T')[0]}
                            </p>
                            <p
                              className={`text-[11px] font-bold mt-0.5 ${
                                remDays === 0
                                  ? 'text-red-600'
                                  : isExpiringSoon
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {remDays === 0
                                ? 'منتهي الصلاحية'
                                : isExpiringSoon
                                ? `قارب على الانتهاء (متبقي ${remDays} يوم)`
                                : `متبقي ${remDays} يوم`}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400">لم يبدأ بعد</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <select
                          disabled={busyReqId === req.id}
                          value={req.status}
                          onChange={(e) =>
                            void handleRequestStatus(req, e.target.value as PackageRequestStatus)
                          }
                          className={`text-xs font-bold px-2.5 py-1.5 rounded-lg outline-none ${
                            REQ_STATUS[req.status]?.cls || 'bg-slate-100'
                          }`}
                        >
                          <option value="pending">بانتظار التأكيد</option>
                          <option value="contacted">تم التواصل</option>
                          <option value="activated">مدفوع ومفعّل</option>
                          <option value="cancelled">ملغي</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {req.status !== 'activated' ? (
                            <button
                              type="button"
                              disabled={busyReqId === req.id}
                              onClick={() => void handleActivateNow(req)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              تأكيد وتفعيل
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={busyReqId === req.id}
                                onClick={() => void handleExtend(req, 30)}
                                title="تمديد الاشتراك 30 يوم إضافية"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold"
                              >
                                <CalendarPlus className="w-3.5 h-3.5" />
                                +30 يوم
                              </button>
                              <button
                                type="button"
                                disabled={busyReqId === req.id}
                                onClick={() => void handleExtend(req, 365)}
                                title="تمديد الاشتراك سنة كاملة"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold"
                              >
                                +سنة
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditRequest(req)}
                            title="تحديث مرجع الدفع وملاحظات المتابعة"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={formatWhatsAppLink(
                              req.client_phone,
                              `مرحباً ${req.client_name}، نتواصل معك من إدارة منصة إعلاناتي بخصوص اشتراكك رقم ${req.subscription_code || ''} في باقة ${req.package_name}`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="فتح محادثة واتساب"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            واتساب
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Payment Reference / Admin Notes Modal */}
      {editingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-950/60" onClick={() => setEditingReq(null)} />
          <form
            onSubmit={handleSaveRequestNotes}
            className="relative bg-white rounded-3xl w-full max-w-md p-6 space-y-4 border border-slate-200 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">تحديث بيانات الدفع والمتابعة</h3>
                <p className="text-xs text-slate-500 tabular-nums">
                  {editingReq.client_name} · {editingReq.subscription_code || editingReq.client_phone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingReq(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                رقم مرجع التحويل / المحفظة
              </label>
              <input
                type="text"
                value={reqEditRef}
                onChange={(e) => setReqEditRef(e.target.value)}
                placeholder="مثال: رقم العملية أو الرقم المحول منه"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm tabular-nums outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ملاحظة داخلية للمتابعة (خاصة بالإدارة)
              </label>
              <textarea
                rows={3}
                value={reqEditNote}
                onChange={(e) => setReqEditNote(e.target.value)}
                placeholder="مثال: تم التحقق من استلام 249 ج.م على فودافون كاش..."
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm resize-none outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={busyReqId === editingReq.id}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white py-2.5 rounded-xl font-bold text-sm"
            >
              حفظ البيانات
            </button>
          </form>
        </div>
      )}

      {/* Package Pricing Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <div>
          <h2 className="font-extrabold text-slate-900 text-base">تعديل أسعار وتفاصيل الباقات</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تظهر التعديلات مباشرة في قسم الباقات بالصفحة الرئيسية
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {packages.map((pkg) => {
            const draft = getPlanDraft(pkg);
            return (
              <div key={pkg.id} className="rounded-2xl border border-slate-200 p-5 space-y-3 bg-slate-50/50">
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => updateDraft(pkg, { name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm font-bold"
                />
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) => updateDraft(pkg, { description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">السعر الشهري</label>
                    <input
                      type="number"
                      value={draft.monthly_price}
                      onChange={(e) => updateDraft(pkg, { monthly_price: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">السعر السنوي</label>
                    <input
                      type="number"
                      value={draft.annual_price}
                      onChange={(e) => updateDraft(pkg, { annual_price: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm tabular-nums"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.popular}
                      onChange={(e) => updateDraft(pkg, { popular: e.target.checked })}
                    />
                    الأكثر طلباً
                  </label>
                  <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.is_active}
                      onChange={(e) => updateDraft(pkg, { is_active: e.target.checked })}
                    />
                    مفعّلة
                  </label>
                </div>
                <button
                  type="button"
                  disabled={savingPlanId === pkg.id}
                  onClick={() => void savePlan(pkg)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingPlanId === pkg.id ? 'جاري الحفظ...' : 'حفظ الباقة'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
