import { useState } from 'react';
import { Check, Clock, Edit3, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { DEFAULT_CATEGORIES, EGYPT_GOVERNORATES } from '../../data/seedData';
import {
  createAd,
  deleteAdAdmin,
  getRemainingDays,
  isAdExpired,
  updateAdAdmin,
} from '../../services/dataService';
import { Ad, AdCategory, AdStatus } from '../../types';

const CUSTOM_CATEGORY_VALUE = '__custom__';

interface AdminAdsManagerProps {
  ads: Ad[];
  categories?: string[];
  onRefresh: () => Promise<void>;
}

const STATUS_META: Record<AdStatus, { label: string; cls: string }> = {
  pending: { label: 'قيد المراجعة', cls: 'bg-amber-50 text-amber-800 border border-amber-200' },
  approved: { label: 'منشور', cls: 'bg-emerald-50 text-emerald-800 border border-emerald-200' },
  rejected: { label: 'مرفوض', cls: 'bg-red-50 text-red-700 border border-red-200' },
  archived: { label: 'مؤرشف', cls: 'bg-slate-100 text-slate-600 border border-slate-200' },
};

export default function AdminAdsManager({
  ads,
  categories = DEFAULT_CATEGORIES,
  onRefresh,
}: AdminAdsManagerProps) {
  const [statusFilter, setStatusFilter] = useState<AdStatus | 'all' | 'expired'>('all');
  const [search, setSearch] = useState('');
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [editCustomCategory, setEditCustomCategory] = useState('');
  const [creatingNew, setCreatingNew] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newAdForm, setNewAdForm] = useState({
    client_name: '',
    title: '',
    category: (categories[0] || 'توزيع') as AdCategory,
    custom_category: '',
    description: '',
    contact: '',
    city: 'القاهرة',
    image: '📦',
    image_url: '',
    banner_url: '',
    package_name: 'مجاني',
    duration_days: 7 as number | null,
    featured: false,
  });

  const filtered = ads.filter((ad) => {
    const expired = isAdExpired(ad);
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'expired'
        ? expired
        : ad.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      ad.title.toLowerCase().includes(q) ||
      (ad.client_name || '').toLowerCase().includes(q) ||
      ad.city.toLowerCase().includes(q) ||
      ad.contact.includes(q);
    return matchesStatus && matchesSearch;
  });

  const handleStatusChange = async (id: string, status: AdStatus) => {
    setBusyId(id);
    try {
      await updateAdAdmin(id, { status });
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleFeatured = async (ad: Ad) => {
    setBusyId(ad.id);
    try {
      await updateAdAdmin(ad.id, { featured: !ad.featured });
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleQuickExtend = async (ad: Ad, days: number | null) => {
    setBusyId(ad.id);
    try {
      const now = new Date();
      const nextExpiry =
        days === null ? null : new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
      await updateAdAdmin(ad.id, {
        status: 'approved',
        starts_at: now.toISOString(),
        expires_at: nextExpiry,
      });
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteAdAdmin(id);
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAd) return;
    const resolvedCategory =
      editingAd.category === CUSTOM_CATEGORY_VALUE
        ? editCustomCategory.trim().replace(/\s+/g, ' ')
        : editingAd.category.trim();
    if (resolvedCategory.length < 2) return;

    setBusyId(editingAd.id);
    try {
      const priorityRank =
        editingAd.package_name === 'المؤسسي'
          ? 2
          : editingAd.package_name === 'الاحترافي' || editingAd.featured
          ? 1
          : 0;
      await updateAdAdmin(editingAd.id, {
        client_name: editingAd.client_name || null,
        title: editingAd.title,
        category: resolvedCategory,
        city: editingAd.city,
        contact: editingAd.contact,
        description: editingAd.description,
        status: editingAd.status,
        featured: editingAd.featured,
        package_name: editingAd.package_name || 'مجاني',
        priority_rank: priorityRank,
        image_url: editingAd.image_url,
        banner_url: editingAd.banner_url,
        expires_at: editingAd.expires_at ?? null,
        client_edits_count: editingAd.client_edits_count ?? 0,
      });
      setEditingAd(null);
      setEditCustomCategory('');
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateAdminAd = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedCategory =
      newAdForm.category === CUSTOM_CATEGORY_VALUE
        ? newAdForm.custom_category.trim().replace(/\s+/g, ' ')
        : newAdForm.category.trim();
    if (resolvedCategory.length < 2) return;

    setBusyId('new');
    try {
      const { custom_category: _unused, ...rest } = newAdForm;
      await createAd({
        ...rest,
        category: resolvedCategory,
        asAdmin: true,
        requireApproval: false,
      });
      setCreatingNew(false);
      setNewAdForm({
        client_name: '',
        title: '',
        category: (categories[0] || 'توزيع') as AdCategory,
        custom_category: '',
        description: '',
        contact: '',
        city: 'القاهرة',
        image: '📦',
        image_url: '',
        banner_url: '',
        package_name: 'مجاني',
        duration_days: 7,
        featured: false,
      });
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  const setEditingDuration = (days: number | null) => {
    if (!editingAd) return;
    if (days === null) {
      setEditingAd({ ...editingAd, expires_at: null });
      return;
    }
    const base = new Date();
    const target = new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    setEditingAd({ ...editingAd, starts_at: base.toISOString(), expires_at: target });
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالعنوان أو المحافظة أو الهاتف..."
              className="w-full pr-10 pl-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {(
              [
                ['all', 'الكل'],
                ['pending', 'قيد المراجعة'],
                ['approved', 'منشور'],
                ['expired', 'منتهي المدة'],
                ['rejected', 'مرفوض'],
                ['archived', 'مؤرشف'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  statusFilter === key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCreatingNew(true)}
          className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          نشر إعلان مباشر
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            لا توجد إعلانات مطابقة لهذه التصفية.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                <tr>
                  <th className="py-3.5 px-4">الإعلان</th>
                  <th className="py-3.5 px-4">الباقة والمدة</th>
                  <th className="py-3.5 px-4">التواصل</th>
                  <th className="py-3.5 px-4">المشاهدات</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((ad) => {
                  const expired = isAdExpired(ad);
                  const remDays = getRemainingDays(ad.expires_at);
                  return (
                    <tr key={ad.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl shrink-0">{ad.image}</span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{ad.title}</p>
                            <p className="text-xs text-slate-500 truncate">
                              {ad.client_name ? `${ad.client_name} · ` : ''}
                              {ad.category} · {ad.city}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                        <p className="font-bold text-slate-800">{ad.package_name || 'مجاني'}</p>
                        <p
                          className={`text-[11px] font-semibold tabular-nums mt-0.5 ${
                            expired
                              ? 'text-red-600'
                              : remDays === null
                              ? 'text-emerald-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {expired
                            ? 'منتهي الصلاحية'
                            : remDays === null
                            ? 'ظهور دائم'
                            : `متبقي ${remDays} يوم (حتى ${ad.expires_at?.split('T')[0]})`}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap tabular-nums text-xs font-semibold text-slate-700">
                        {ad.contact}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap tabular-nums text-xs font-bold text-slate-700">
                        {ad.views_count}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                              expired && ad.status === 'approved'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : STATUS_META[ad.status]?.cls || 'bg-slate-100'
                            }`}
                          >
                            {expired && ad.status === 'approved'
                              ? 'منتهي تلقائياً'
                              : STATUS_META[ad.status]?.label || ad.status}
                          </span>
                          {(ad.client_edits_count || 0) >= 1 && (
                            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 tabular-nums">
                              عدّله المعلن (1/1)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {ad.status !== 'approved' && (
                            <button
                              type="button"
                              disabled={busyId === ad.id}
                              onClick={() => void handleStatusChange(ad.id, 'approved')}
                              title="اعتماد ونشر"
                              className="p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          {ad.status === 'pending' && (
                            <button
                              type="button"
                              disabled={busyId === ad.id}
                              onClick={() => void handleStatusChange(ad.id, 'rejected')}
                              title="رفض"
                              className="p-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                          {expired && (
                            <button
                              type="button"
                              disabled={busyId === ad.id}
                              onClick={() => void handleQuickExtend(ad, 7)}
                              title="تجديد الظهور لمدة 7 أيام"
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-bold inline-flex items-center gap-1"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              +7 أيام
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyId === ad.id}
                            onClick={() => void handleToggleFeatured(ad)}
                            title={ad.featured ? 'إزالة التمييز' : 'تمييز الإعلان'}
                            className={`p-2 rounded-lg transition-colors ${
                              ad.featured
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-500 hover:text-amber-700'
                            }`}
                          >
                            <Star className={`w-4 h-4 ${ad.featured ? 'fill-amber-400' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAd(ad);
                              setEditCustomCategory('');
                            }}
                            title="تعديل"
                            className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={busyId === ad.id}
                            onClick={() => void handleDelete(ad.id)}
                            title="حذف"
                            className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {editingAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-950/60" onClick={() => setEditingAd(null)} />
          <form
            onSubmit={handleSaveEdit}
            className="relative bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 border border-slate-200 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-lg text-slate-900">تعديل الإعلان والمدة</h3>
              <button type="button" onClick={() => setEditingAd(null)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="اسم المعلن / المسؤول"
              value={editingAd.client_name || ''}
              onChange={(e) => setEditingAd({ ...editingAd, client_name: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm"
            />
            <input
              type="text"
              required
              value={editingAd.title}
              onChange={(e) => setEditingAd({ ...editingAd, title: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={editingAd.category}
                onChange={(e) =>
                  setEditingAd({ ...editingAd, category: e.target.value as AdCategory })
                }
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
              >
                {Array.from(
                  new Set([
                    ...categories,
                    ...(editingAd.category && editingAd.category !== CUSTOM_CATEGORY_VALUE
                      ? [editingAd.category]
                      : []),
                  ])
                ).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value={CUSTOM_CATEGORY_VALUE}>+ إضافة تصنيف جديد غير موجود...</option>
              </select>
              <select
                value={editingAd.city}
                onChange={(e) => setEditingAd({ ...editingAd, city: e.target.value })}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
              >
                {EGYPT_GOVERNORATES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            {editingAd.category === CUSTOM_CATEGORY_VALUE && (
              <input
                type="text"
                required
                maxLength={60}
                placeholder="اكتب اسم التصنيف الجديد (سيتم حفظه ضمن القائمة)..."
                value={editCustomCategory}
                onChange={(e) => setEditCustomCategory(e.target.value)}
                className="w-full px-4 py-2.5 border border-blue-200 bg-blue-50/40 rounded-xl text-sm"
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <input
                type="tel"
                required
                value={editingAd.contact}
                onChange={(e) => setEditingAd({ ...editingAd, contact: e.target.value })}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm tabular-nums"
              />
              <select
                value={editingAd.status}
                onChange={(e) =>
                  setEditingAd({ ...editingAd, status: e.target.value as AdStatus })
                }
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
              >
                <option value="pending">قيد المراجعة</option>
                <option value="approved">منشور</option>
                <option value="rejected">مرفوض</option>
                <option value="archived">مؤرشف</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">الباقة</label>
                <select
                  value={editingAd.package_name || 'مجاني'}
                  onChange={(e) => setEditingAd({ ...editingAd, package_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
                >
                  <option value="مجاني">مجاني (7 أيام)</option>
                  <option value="الاحترافي">الاحترافي (30 يوم)</option>
                  <option value="المؤسسي">المؤسسي (ظهور دائم)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">تجديد سريع للمدة</label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingDuration(7)}
                    className="flex-1 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold"
                  >
                    +7 أيام
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingDuration(30)}
                    className="flex-1 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold"
                  >
                    +30 يوم
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingDuration(null)}
                    className="flex-1 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold"
                  >
                    دائم
                  </button>
                </div>
              </div>
            </div>

            <input
              type="url"
              placeholder="رابط الصورة الرئيسية (اختياري)"
              value={editingAd.image_url || ''}
              onChange={(e) => setEditingAd({ ...editingAd, image_url: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs text-left"
              dir="ltr"
            />
            <input
              type="url"
              placeholder="رابط البانر المؤسسي (اختياري)"
              value={editingAd.banner_url || ''}
              onChange={(e) => setEditingAd({ ...editingAd, banner_url: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs text-left"
              dir="ltr"
            />

            <textarea
              rows={4}
              required
              value={editingAd.description}
              onChange={(e) => setEditingAd({ ...editingAd, description: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm resize-none"
            />
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={editingAd.featured}
                onChange={(e) => setEditingAd({ ...editingAd, featured: e.target.checked })}
              />
              تمييز الإعلان في أعلى النتائج
            </label>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-700 tabular-nums">
                تعديل المعلن الذاتي: {(editingAd.client_edits_count || 0) >= 1 ? 'مُستخدم (1/1)' : 'متاح (0/1)'}
              </span>
              {(editingAd.client_edits_count || 0) >= 1 && (
                <button
                  type="button"
                  onClick={() => setEditingAd({ ...editingAd, client_edits_count: 0 })}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold"
                >
                  إتاحة تعديل جديد للمعلن
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={busyId === editingAd.id}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-xl font-bold text-sm"
            >
              حفظ التعديلات
            </button>
          </form>
        </div>
      )}

      {creatingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-950/60" onClick={() => setCreatingNew(false)} />
          <form
            onSubmit={handleCreateAdminAd}
            className="relative bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 border border-slate-200 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-lg text-slate-900">نشر إعلان مباشر من الإدارة</h3>
              <button type="button" onClick={() => setCreatingNew(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="اسم المعلن / المسؤول"
              value={newAdForm.client_name}
              onChange={(e) => setNewAdForm({ ...newAdForm, client_name: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm"
            />
            <input
              type="text"
              required
              placeholder="عنوان الإعلان"
              value={newAdForm.title}
              onChange={(e) => setNewAdForm({ ...newAdForm, title: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={newAdForm.category}
                onChange={(e) =>
                  setNewAdForm({ ...newAdForm, category: e.target.value as AdCategory })
                }
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value={CUSTOM_CATEGORY_VALUE}>+ إضافة تصنيف جديد غير موجود...</option>
              </select>
              <select
                value={newAdForm.city}
                onChange={(e) => setNewAdForm({ ...newAdForm, city: e.target.value })}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
              >
                {EGYPT_GOVERNORATES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            {newAdForm.category === CUSTOM_CATEGORY_VALUE && (
              <input
                type="text"
                required
                maxLength={60}
                placeholder="اكتب اسم التصنيف الجديد (سيتم حفظه ضمن القائمة)..."
                value={newAdForm.custom_category}
                onChange={(e) => setNewAdForm({ ...newAdForm, custom_category: e.target.value })}
                className="w-full px-4 py-2.5 border border-blue-200 bg-blue-50/40 rounded-xl text-sm"
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <select
                value={newAdForm.package_name}
                onChange={(e) => {
                  const pkg = e.target.value;
                  setNewAdForm({
                    ...newAdForm,
                    package_name: pkg,
                    duration_days: pkg === 'مجاني' ? 7 : pkg === 'الاحترافي' ? 30 : null,
                    featured: pkg !== 'مجاني',
                  });
                }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
              >
                <option value="مجاني">مجاني (7 أيام)</option>
                <option value="الاحترافي">الاحترافي (30 يوم)</option>
                <option value="المؤسسي">المؤسسي (دائم + بانر)</option>
              </select>
              <input
                type="tel"
                required
                placeholder="رقم التواصل (01xxxxxxxxx)"
                value={newAdForm.contact}
                onChange={(e) => setNewAdForm({ ...newAdForm, contact: e.target.value })}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm tabular-nums"
              />
            </div>
            <input
              type="url"
              placeholder="رابط البانر الإعلاني (اختياري)"
              value={newAdForm.banner_url}
              onChange={(e) => setNewAdForm({ ...newAdForm, banner_url: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs text-left"
              dir="ltr"
            />
            <textarea
              rows={4}
              required
              placeholder="تفاصيل الإعلان..."
              value={newAdForm.description}
              onChange={(e) => setNewAdForm({ ...newAdForm, description: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm resize-none"
            />
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newAdForm.featured}
                onChange={(e) => setNewAdForm({ ...newAdForm, featured: e.target.checked })}
              />
              نشر كإعلان مميز
            </label>
            <button
              type="submit"
              disabled={busyId === 'new'}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-xl font-bold text-sm"
            >
              نشر فوري
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
