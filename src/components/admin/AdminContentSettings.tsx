import { useState } from 'react';
import { CheckCircle2, Database, Eye, EyeOff, Plus, Save, Trash2 } from 'lucide-react';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  createTestimonialAdmin,
  deleteTestimonialAdmin,
  updateSiteSettings,
  updateTestimonialAdmin,
} from '../../services/dataService';
import { SiteSettings, Testimonial } from '../../types';

interface AdminContentSettingsProps {
  settings: SiteSettings;
  testimonials: Testimonial[];
  onRefresh: () => Promise<void>;
}

export default function AdminContentSettings({
  settings,
  testimonials,
  onRefresh,
}: AdminContentSettingsProps) {
  const [form, setForm] = useState<SiteSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const [newTestimonial, setNewTestimonial] = useState({
    name: '',
    role: '',
    city: 'القاهرة',
    text: '',
    rating: 5,
    avatar: '👨‍💼',
    is_visible: true,
  });
  const [addingTest, setAddingTest] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await updateSiteSettings(form);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
      await onRefresh();
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingTest(true);
    try {
      await createTestimonialAdmin(newTestimonial);
      setNewTestimonial({
        name: '',
        role: '',
        city: 'القاهرة',
        text: '',
        rating: 5,
        avatar: '👨‍💼',
        is_visible: true,
      });
      await onRefresh();
    } finally {
      setAddingTest(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-700" />
              حالة الربط مع Supabase والنشر على Vercel
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              ملف <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">supabase/schema.sql</code> جاهز للتشغيل داخل مشروع Supabase الخاص بك بجوار جداول Work-System بدون أي تعارض.
            </p>
          </div>
          <span
            className={`text-xs font-bold px-3 py-1.5 rounded-xl shrink-0 ${
              isSupabaseConfigured
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            {isSupabaseConfigured ? 'متصل بـ Supabase' : 'وضع المعاينة المحلية'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700 bg-slate-50 rounded-2xl p-4 border border-slate-200">
          <div className="space-y-1.5">
            <p className="font-extrabold text-slate-900">1. الجداول المخصصة لمنصة إعلاناتي:</p>
            <p className="font-mono text-[11px] text-slate-600 leading-relaxed">
              elanati_admins · elanati_ads · elanati_contact_messages · elanati_support_messages · elanati_package_requests · elanati_packages · elanati_testimonials · elanati_site_settings
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="font-extrabold text-slate-900">2. متغيرات البيئة المطلوبة في Vercel:</p>
            <p className="font-mono text-[11px] text-slate-600">
              VITE_SUPABASE_URL<br />
              VITE_SUPABASE_ANON_KEY
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-slate-900 text-base">إعدادات المنصة والتواصل والإحصائيات</h2>
            <p className="text-xs text-slate-500 mt-0.5">تظهر هذه القيم مباشرة في الواجهة الرئيسية</p>
          </div>
          {savedNotice && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              تم الحفظ
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المنصة</label>
            <input
              type="text"
              required
              value={form.site_name}
              onChange={(e) => setForm({ ...form, site_name: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">البريد الإلكتروني للإدارة</label>
            <input
              type="email"
              required
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">هاتف التواصل</label>
            <input
              type="tel"
              required
              value={form.contact_phone}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم الواتساب (بالكود الدولي)</label>
            <input
              type="text"
              required
              value={form.whatsapp_number}
              onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">معلن نشط</label>
            <input
              type="number"
              value={form.stat_advertisers}
              onChange={(e) => setForm({ ...form, stat_advertisers: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">زيارة شهرية</label>
            <input
              type="number"
              value={form.stat_visits}
              onChange={(e) => setForm({ ...form, stat_visits: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">تاجر وموزع</label>
            <input
              type="number"
              value={form.stat_traders}
              onChange={(e) => setForm({ ...form, stat_traders: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">نسبة الرضا %</label>
            <input
              type="number"
              max={100}
              min={1}
              value={form.stat_satisfaction}
              onChange={(e) => setForm({ ...form, stat_satisfaction: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm tabular-nums"
            />
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm font-bold text-slate-800 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={form.require_ad_approval}
            onChange={(e) => setForm({ ...form, require_ad_approval: e.target.checked })}
          />
          مراجعة الإعلانات الجديدة من لوحة المدير قبل نشرها للجمهور
        </label>

        <button
          type="submit"
          disabled={savingSettings}
          className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-xl text-sm font-bold inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {savingSettings ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <h2 className="font-extrabold text-slate-900 text-base">إدارة آراء العملاء</h2>

        <form onSubmit={handleAddTestimonial} className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <input
            type="text"
            required
            placeholder="اسم العميل"
            value={newTestimonial.name}
            onChange={(e) => setNewTestimonial({ ...newTestimonial, name: e.target.value })}
            className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm"
          />
          <input
            type="text"
            required
            placeholder="المسمى (مثال: موزع أغذية)"
            value={newTestimonial.role}
            onChange={(e) => setNewTestimonial({ ...newTestimonial, role: e.target.value })}
            className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm"
          />
          <input
            type="text"
            required
            placeholder="المحافظة"
            value={newTestimonial.city}
            onChange={(e) => setNewTestimonial({ ...newTestimonial, city: e.target.value })}
            className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm"
          />
          <button
            type="submit"
            disabled={addingTest}
            className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 py-2.5"
          >
            <Plus className="w-4 h-4" />
            إضافة رأي
          </button>
          <input
            type="text"
            required
            placeholder="نص رأي العميل..."
            value={newTestimonial.text}
            onChange={(e) => setNewTestimonial({ ...newTestimonial, text: e.target.value })}
            className="sm:col-span-4 px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm"
          />
        </form>

        <div className="divide-y divide-slate-100">
          {testimonials.map((t) => (
            <div key={t.id} className="py-3.5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-bold text-slate-900 text-sm">
                  {t.name} · <span className="text-slate-500 font-medium">{t.role} ({t.city})</span>
                </p>
                <p className="text-xs text-slate-600 truncate mt-0.5">{t.text}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    void updateTestimonialAdmin(t.id, { is_visible: !t.is_visible }).then(onRefresh)
                  }
                  title={t.is_visible ? 'إخفاء' : 'إظهار'}
                  className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  {t.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteTestimonialAdmin(t.id).then(onRefresh)}
                  title="حذف"
                  className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
