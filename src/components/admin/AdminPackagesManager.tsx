import { useState } from 'react';
import { CheckCircle2, MessageCircle, Save } from 'lucide-react';
import { formatWhatsAppLink } from '../../lib/supabase';
import {
  activateSubscriptionAdmin,
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
  activated: { label: 'نشط ومفعّل', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  cancelled: { label: 'ملغي', cls: 'bg-slate-100 text-slate-600 border border-slate-200' },
};

const PAYMENT_LABEL: Record<string, string> = {
  vodafone_cash: 'فودافون كاش',
  instapay: 'إنستاباي',
  bank_transfer: 'تحويل بنكي',
};

export default function AdminPackagesManager({
  requests,
  packages,
  onRefresh,
}: AdminPackagesManagerProps) {
  const [editingPlans, setEditingPlans] = useState<Record<string, PackagePlan>>({});
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [busyReqId, setBusyReqId] = useState<string | null>(null);

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
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-extrabold text-slate-900 text-base">
            طلبات الاشتراك والسداد بالجنيه المصري ({requests.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            راجع مرجع الدفع وفعّل اشتراك العميل بضغطة واحدة ليبدأ تاريخ البداية والنهاية والعدّاد التنازلي تلقائياً
          </p>
        </div>

        {requests.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            لا توجد طلبات اشتراك واردة حتى الآن.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                <tr>
                  <th className="py-3.5 px-4">العميل / الكود</th>
                  <th className="py-3.5 px-4">الباقة والسداد</th>
                  <th className="py-3.5 px-4">مدة الاشتراك</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4">إجراء سريع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => {
                  const remDays = getRemainingDays(req.expires_at);
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
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                        <p className="font-bold text-blue-700">
                          {req.package_name} ({req.billing_cycle === 'annual' ? 'سنوي' : 'شهري'})
                        </p>
                        <p className="font-bold text-slate-900 tabular-nums mt-0.5">
                          {req.price_egp} ج.م · {PAYMENT_LABEL[req.payment_method] || req.payment_method}
                        </p>
                        {req.payment_reference && (
                          <p className="text-[11px] text-slate-500 tabular-nums">
                            مرجع الدفع: {req.payment_reference}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs tabular-nums">
                        {req.starts_at && req.expires_at ? (
                          <div>
                            <p className="text-slate-700 font-semibold">
                              من {req.starts_at.split('T')[0]} ← {req.expires_at.split('T')[0]}
                            </p>
                            <p
                              className={`text-[11px] font-bold mt-0.5 ${
                                remDays === 0 ? 'text-red-600' : 'text-emerald-700'
                              }`}
                            >
                              {remDays === 0 ? 'منتهي' : `متبقي ${remDays} يوم`}
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
                          <option value="activated">نشط ومفعّل</option>
                          <option value="cancelled">ملغي</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {req.status !== 'activated' && (
                            <button
                              type="button"
                              disabled={busyReqId === req.id}
                              onClick={() => void handleActivateNow(req)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              تفعيل الاشتراك
                            </button>
                          )}
                          <a
                            href={formatWhatsAppLink(
                              req.client_phone,
                              `مرحباً ${req.client_name}، نتواصل معك من إدارة منصة إعلاناتي بخصوص اشتراكك رقم ${req.subscription_code || ''} في باقة ${req.package_name}`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
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
