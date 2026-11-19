import { useState } from 'react';
import { MessageCircle, Save } from 'lucide-react';
import { formatWhatsAppLink } from '../../lib/supabase';
import { updatePackageAdmin, updatePackageRequestAdmin } from '../../services/dataService';
import { PackagePlan, PackageRequest, PackageRequestStatus } from '../../types';

interface AdminPackagesManagerProps {
  requests: PackageRequest[];
  packages: PackagePlan[];
  onRefresh: () => Promise<void>;
}

const REQ_STATUS: Record<PackageRequestStatus, { label: string; cls: string }> = {
  pending: { label: 'طلب جديد', cls: 'bg-amber-50 text-amber-800 border border-amber-200' },
  contacted: { label: 'تم التواصل', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  activated: { label: 'تم التفعيل', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  cancelled: { label: 'ملغي', cls: 'bg-slate-100 text-slate-600 border border-slate-200' },
};

export default function AdminPackagesManager({
  requests,
  packages,
  onRefresh,
}: AdminPackagesManagerProps) {
  const [editingPlans, setEditingPlans] = useState<Record<string, PackagePlan>>({});
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);

  const handleRequestStatus = async (id: string, status: PackageRequestStatus) => {
    await updatePackageRequestAdmin(id, { status });
    await onRefresh();
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
            طلبات الاشتراك في الباقات ({requests.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تواصل مع التجار لتفعيل باقاتهم عبر الهاتف أو واتساب وحدّث حالة الطلب
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
                  <th className="py-3.5 px-4">العميل</th>
                  <th className="py-3.5 px-4">الباقة</th>
                  <th className="py-3.5 px-4">الهاتف / الشركة</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4">تواصل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{req.client_name}</p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {req.created_at.split('T')[0]}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="font-bold text-blue-700">{req.package_name}</p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {req.price_egp} ج.م · {req.billing_cycle === 'annual' ? 'سنوي' : 'شهري'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-xs font-bold text-slate-800 tabular-nums">
                        {req.client_phone}
                      </p>
                      {req.company_name && (
                        <p className="text-xs text-slate-500">{req.company_name}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <select
                        value={req.status}
                        onChange={(e) =>
                          void handleRequestStatus(req.id, e.target.value as PackageRequestStatus)
                        }
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-lg outline-none ${
                          REQ_STATUS[req.status]?.cls || 'bg-slate-100'
                        }`}
                      >
                        <option value="pending">طلب جديد</option>
                        <option value="contacted">تم التواصل</option>
                        <option value="activated">تم التفعيل</option>
                        <option value="cancelled">ملغي</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <a
                        href={formatWhatsAppLink(
                          req.client_phone,
                          `مرحباً ${req.client_name}، نتواصل معك من إدارة منصة إعلاناتي بخصوص طلب الاشتراك في باقة ${req.package_name}`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        واتساب
                      </a>
                    </td>
                  </tr>
                ))}
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
