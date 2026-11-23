import { getCategoryGroup } from '../data/seedData';
import { AdSpecs } from '../types';

interface CategorySpecsFieldsProps {
  category: string;
  specs: AdSpecs;
  onChange: (nextSpecs: AdSpecs) => void;
}

export default function CategorySpecsFields({
  category,
  specs,
  onChange,
}: CategorySpecsFieldsProps) {
  const group = getCategoryGroup(category);
  const current = specs || {};

  const setField = (key: string, value: string) => {
    const next = { ...current };
    if (!value.trim()) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange(next);
  };

  if (group === 'cars') {
    return (
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <p className="text-xs font-extrabold text-slate-900">مواصفات السيارة (اختياري)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">الماركة والموديل</label>
            <input
              type="text"
              value={String(current.brand_model || '')}
              onChange={(e) => setField('brand_model', e.target.value)}
              placeholder="مثال: تويوتا كورولا"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">سنة الصنع</label>
            <input
              type="number"
              min={1960}
              max={2027}
              value={String(current.year || '')}
              onChange={(e) => setField('year', e.target.value)}
              placeholder="مثال: 2021"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-sm tabular-nums outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              المسافة المقطوعة (كم)
            </label>
            <input
              type="number"
              min={0}
              value={String(current.mileage_km || '')}
              onChange={(e) => setField('mileage_km', e.target.value)}
              placeholder="مثال: 65000"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-sm tabular-nums outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ناقل الحركة</label>
            <select
              value={String(current.transmission || '')}
              onChange={(e) => setField('transmission', e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">اختر الناقل</option>
              <option value="أوتوماتيك">أوتوماتيك</option>
              <option value="مانيوال">مانيوال</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1">نوع الوقود</label>
            <select
              value={String(current.fuel || '')}
              onChange={(e) => setField('fuel', e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">اختر نوع الوقود</option>
              <option value="بنزين">بنزين</option>
              <option value="ديزل">ديزل</option>
              <option value="غاز طبيعي">غاز طبيعي</option>
              <option value="هايبرد">هايبرد</option>
              <option value="كهرباء">كهرباء</option>
            </select>
          </div>
        </div>
      </div>
    );
  }

  if (group === 'real_estate') {
    return (
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <p className="text-xs font-extrabold text-slate-900">مواصفات العقار (اختياري)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">نوع العقار</label>
            <select
              value={String(current.property_type || '')}
              onChange={(e) => setField('property_type', e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">اختر النوع</option>
              <option value="شقة">شقة</option>
              <option value="فيلا">فيلا</option>
              <option value="محل تجاري">محل تجاري</option>
              <option value="أرض">أرض</option>
              <option value="مكتب إداري">مكتب إداري</option>
              <option value="مخزن">مخزن</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">الغرض</label>
            <select
              value={String(current.deal_type || '')}
              onChange={(e) => setField('deal_type', e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">اختر الغرض</option>
              <option value="للبيع">للبيع</option>
              <option value="للإيجار">للإيجار</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">المساحة (م²)</label>
            <input
              type="number"
              min={1}
              value={String(current.area_sqm || '')}
              onChange={(e) => setField('area_sqm', e.target.value)}
              placeholder="مثال: 150"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-sm tabular-nums outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">عدد الغرف</label>
            <input
              type="number"
              min={0}
              value={String(current.rooms || '')}
              onChange={(e) => setField('rooms', e.target.value)}
              placeholder="مثال: 3"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-sm tabular-nums outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1">الدور</label>
            <input
              type="text"
              value={String(current.floor || '')}
              onChange={(e) => setField('floor', e.target.value)}
              placeholder="مثال: الدور الثالث / أرضي"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>
      </div>
    );
  }

  if (group === 'commercial') {
    return (
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <p className="text-xs font-extrabold text-slate-900">تفاصيل التجارة والتوزيع (اختياري)</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">نوع التعامل</label>
            <select
              value={String(current.trade_type || '')}
              onChange={(e) => setField('trade_type', e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">اختر</option>
              <option value="جملة">جملة</option>
              <option value="تجزئة">تجزئة</option>
              <option value="جملة وتجزئة">جملة وتجزئة</option>
              <option value="توكيل حصري">توكيل حصري</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">الحد الأدنى للطلب</label>
            <input
              type="text"
              value={String(current.min_order || '')}
              onChange={(e) => setField('min_order', e.target.value)}
              placeholder="مثال: 10 كراتين"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">خدمة التوصيل</label>
            <select
              value={String(current.delivery_available || '')}
              onChange={(e) => setField('delivery_available', e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">اختر</option>
              <option value="متاح لجميع المحافظات">متاح لجميع المحافظات</option>
              <option value="متاح داخل المحافظة">متاح داخل المحافظة</option>
              <option value="استلام من المقر">استلام من المقر</option>
            </select>
          </div>
        </div>
      </div>
    );
  }

  if (group === 'jobs') {
    return (
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <p className="text-xs font-extrabold text-slate-900">تفاصيل الوظيفة (اختياري)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">نظام العمل</label>
            <select
              value={String(current.job_type || '')}
              onChange={(e) => setField('job_type', e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">اختر النظام</option>
              <option value="دوام كامل">دوام كامل</option>
              <option value="دوام جزئي">دوام جزئي</option>
              <option value="عمل عن بُعد">عمل عن بُعد</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">الخبرة المطلوبة</label>
            <input
              type="text"
              value={String(current.experience || '')}
              onChange={(e) => setField('experience', e.target.value)}
              placeholder="مثال: سنتان أو بدون خبرة"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
      <label className="block text-xs font-bold text-slate-700">توافر الشحن / التوصيل (اختياري)</label>
      <select
        value={String(current.delivery_available || '')}
        onChange={(e) => setField('delivery_available', e.target.value)}
        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-blue-600"
      >
        <option value="">غير محدد</option>
        <option value="متاح لجميع المحافظات">متاح لجميع المحافظات</option>
        <option value="متاح داخل المحافظة">متاح داخل المحافظة</option>
        <option value="مقابلة / استلام يدوي">مقابلة / استلام يدوي</option>
      </select>
    </div>
  );
}
