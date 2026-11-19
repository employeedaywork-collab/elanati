import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Plus,
  Save,
  Tags,
  Trash2,
  Wallet,
} from 'lucide-react';
import { DEFAULT_CATEGORIES } from '../../data/seedData';
import {
  addCategory,
  createTestimonialAdmin,
  deleteCategoryAdmin,
  deleteTestimonialAdmin,
  updateSiteSettings,
  updateTestimonialAdmin,
} from '../../services/dataService';
import { CategoryItem, SiteSettings, Testimonial } from '../../types';

interface AdminContentSettingsProps {
  settings: SiteSettings;
  testimonials: Testimonial[];
  categoryItems?: CategoryItem[];
  onRefresh: () => Promise<void>;
}

export default function AdminContentSettings({
  settings,
  testimonials,
  categoryItems = [],
  onRefresh,
}: AdminContentSettingsProps) {
  const [form, setForm] = useState<SiteSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [catError, setCatError] = useState('');

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

  useEffect(() => {
    setForm(settings);
  }, [settings]);

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

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatError('');
    setAddingCat(true);
    try {
      await addCategory(newCategoryName);
      setNewCategoryName('');
      await onRefresh();
    } catch (err: any) {
      setCatError(err?.message || 'تعذر إضافة التصنيف');
    } finally {
      setAddingCat(false);
    }
  };

  const handleDeleteCategory = async (item: CategoryItem) => {
    setCatError('');
    try {
      await deleteCategoryAdmin(item.id);
      await onRefresh();
    } catch (err: any) {
      setCatError(err?.message || 'تعذر حذف التصنيف');
    }
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Ad Duration Rules */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-700" />
                التحكم في مدة ظهور الإعلانات التلقائية
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تختفي الإعلانات المجانية تلقائياً من الموقع بعد انتهاء المدة المحددة، بينما تستمر باقة المؤسسي بظهور دائم
              </p>
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
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                مدة ظهور الإعلان المجاني (بالأيام)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                required
                value={form.free_ad_days || 7}
                onChange={(e) => setForm({ ...form, free_ad_days: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm tabular-nums"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                الافتراضي 7 أيام (أسبوع واحد فقط) ثم يختفي الإعلان تلقائياً
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                مدة ظهور إعلان الباقة الاحترافية (بالأيام)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                required
                value={form.pro_ad_days || 30}
                onChange={(e) => setForm({ ...form, pro_ad_days: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm tabular-nums"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                الافتراضي 30 يوماً مع إمكانية إضافة حتى 10 إعلانات وتمييز نجمي
              </p>
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
        </div>

        {/* Egyptian Pound Payment Settings */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div>
            <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-700" />
              إعدادات طرق سداد الاشتراكات بالجنيه المصري
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              تظهر هذه البيانات للعملاء عند طلب الاشتراك في الباقة الاحترافية أو المؤسسية
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                رقم فودافون كاش / المحافظ الإلكترونية
              </label>
              <input
                type="text"
                required
                value={form.vodafone_cash_number}
                onChange={(e) => setForm({ ...form, vodafone_cash_number: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                حساب أو رقم إنستاباي (InstaPay)
              </label>
              <input
                type="text"
                required
                value={form.instapay_handle}
                onChange={(e) => setForm({ ...form, instapay_handle: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm tabular-nums"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                بيانات الحساب البنكي للتحويل بالجنيه المصري
              </label>
              <input
                type="text"
                required
                value={form.bank_account_info}
                onChange={(e) => setForm({ ...form, bank_account_info: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تعليمات السداد للعملاء
              </label>
              <textarea
                rows={2}
                value={form.payment_instructions}
                onChange={(e) => setForm({ ...form, payment_instructions: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm resize-none"
              />
            </div>
          </div>
        </div>

        {/* General Platform & Stats */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div>
            <h2 className="font-extrabold text-slate-900 text-base">إعدادات المنصة والتواصل والإحصائيات</h2>
            <p className="text-xs text-slate-500 mt-0.5">تظهر هذه القيم مباشرة في الواجهة الرئيسية</p>
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

          <button
            type="submit"
            disabled={savingSettings}
            className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-xl text-sm font-bold inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {savingSettings ? 'جاري الحفظ...' : 'حفظ جميع الإعدادات'}
          </button>
        </div>
      </form>

      {/* Dynamic Categories Management */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <div>
          <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <Tags className="w-5 h-5 text-blue-700" />
            إدارة تصنيفات الإعلانات الحالية
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            أي تصنيف جديد يضيفه المعلن أو الإدارة يتم حفظه هنا تلقائياً ويظهر في قائمة التصنيفات وفلتر الموقع
          </p>
        </div>

        <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            maxLength={60}
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="أدخل اسم تصنيف جديد (مثال: مستلزمات طبية، قطع غيار...)"
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={addingCat}
            className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            {addingCat ? 'جاري الإضافة...' : 'إضافة وحفظ التصنيف'}
          </button>
        </form>

        {catError && (
          <p className="text-xs font-bold text-red-600">{catError}</p>
        )}

        <div className="flex flex-wrap gap-2.5">
          {categoryItems.map((cat) => {
            const isDefault = DEFAULT_CATEGORIES.includes(cat.name);
            return (
              <div
                key={cat.id}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800"
              >
                <span>{cat.name}</span>
                {isDefault ? (
                  <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    أساسي
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleDeleteCategory(cat)}
                    title="حذف التصنيف"
                    className="p-1 rounded-md text-red-600 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
