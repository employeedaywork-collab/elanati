import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Edit3, KeyRound, PlusCircle, X } from 'lucide-react';
import { DEFAULT_CATEGORIES, EGYPT_GOVERNORATES } from '../data/seedData';
import { editAdByClient, getSavedAdPin } from '../services/dataService';
import { Ad, AdCategory, AdSpecs, ItemCondition } from '../types';
import AdImageUploader from './AdImageUploader';
import CategorySpecsFields from './CategorySpecsFields';
import GoogleMapLocationPicker from './GoogleMapLocationPicker';

const CUSTOM_CATEGORY_VALUE = '__custom__';

interface ClientEditAdModalProps {
  ad: Ad;
  ownerQuery: string;
  categories?: string[];
  onClose: () => void;
  onSaved: (updated: Ad) => Promise<void> | void;
}

export default function ClientEditAdModal({
  ad,
  ownerQuery,
  categories = DEFAULT_CATEGORIES,
  onClose,
  onSaved,
}: ClientEditAdModalProps) {
  const [verifyCode, setVerifyCode] = useState(() => {
    const savedPin = getSavedAdPin(ad.id);
    if (savedPin) return savedPin;
    const qUpper = ownerQuery.trim().toUpperCase();
    if (qUpper.startsWith('SUB-') && !qUpper.includes('*')) return qUpper;
    try {
      const lastSub = (localStorage.getItem('elanati_last_sub_code') || '').trim().toUpperCase();
      if (lastSub) return lastSub;
    } catch {
      // ignore
    }
    return '';
  });

  const [form, setForm] = useState({
    title: ad.title,
    category: ad.category as AdCategory,
    custom_category: '',
    city: ad.city,
    description: ad.description,
    image: ad.image || '📦',
    image_url: ad.image_url || '',
    extra_images: Array.isArray(ad.extra_images) ? ad.extra_images : [],
    price: ad.price !== null && ad.price !== undefined ? String(ad.price) : '',
    price_negotiable: Boolean(ad.price_negotiable),
    item_condition: (ad.item_condition || 'unspecified') as ItemCondition,
    specs: (ad.specs || {}) as AdSpecs,
    latitude: ad.latitude ?? null,
    longitude: ad.longitude ?? null,
    location_address: ad.location_address || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const emojis = ['📦', '🚗', '🏠', '💻', '👔', '💄', '🪑', '🏗️', '🍕', '📱', '💊', '🎁'];
  const allCategoryOptions = Array.from(
    new Set([...categories, ...(ad.category ? [ad.category] : [])])
  );

  const resolvedCategory =
    form.category === CUSTOM_CATEGORY_VALUE
      ? form.custom_category.trim().replace(/\s+/g, ' ')
      : form.category.trim();

  const isPaid = (ad.package_name || 'مجاني') !== 'مجاني';
  const maxImages = isPaid ? 6 : 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (resolvedCategory.length < 2) {
      setError('يرجى اختيار أو كتابة اسم تصنيف صحيح');
      return;
    }

    if (verifyCode.trim().length < 5) {
      setError('يرجى إدخال كود تعديل الإعلان أو كود الاشتراك للتحقق من الملكية');
      return;
    }

    const parsedPrice =
      form.price.trim() !== '' && Number.isFinite(Number(form.price))
        ? Math.max(0, Number(form.price))
        : null;

    setSaving(true);
    try {
      const updated = await editAdByClient({
        adId: ad.id,
        ownerQuery: verifyCode.trim(),
        title: form.title,
        category: resolvedCategory,
        city: form.city,
        description: form.description,
        image: form.image,
        image_url: form.image_url,
        extra_images: isPaid ? form.extra_images : [],
        price: parsedPrice,
        price_negotiable: form.price_negotiable,
        item_condition: form.item_condition,
        specs: form.specs,
        latitude: form.latitude,
        longitude: form.longitude,
        location_address: form.location_address.trim() || null,
      });
      setDone(true);
      await onSaved(updated);
    } catch (err: any) {
      setError(err?.message || 'تعذر حفظ التعديل، حاول مرة أخرى');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200">
        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-blue-700" />
            <h3 className="text-lg font-extrabold text-slate-900">تعديل الإعلان (مرة واحدة فقط)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-slate-700" />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h4 className="text-xl font-extrabold text-slate-900">تم حفظ تعديل الإعلان بنجاح</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              تم استخدام فرصتك الوحيدة لتعديل هذا الإعلان مباشرة. لأي تعديل إضافي مستقبلاً يمكنك إرسال طلب للإدارة من نفس الصفحة.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-xl font-bold text-sm"
            >
              العودة لقسم الاشتراكات
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                <strong>تنبيه مهم:</strong> متاح للمعلن تعديل الإعلان <strong>مرة واحدة فقط</strong>. بعد حفظ هذا التعديل، أي تعديل إضافي يكون عن طريق إدارة المنصة.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-blue-700" />
                كود تعديل الإعلان أو كود الاشتراك (للتحقق من الملكية) *
              </label>
              <input
                type="text"
                required
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="مثال: A4F9C21B أو SUB-12345"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-left outline-none focus:ring-2 focus:ring-blue-600"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">أيقونة الإعلان</label>
              <div className="flex flex-wrap gap-1.5">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setForm({ ...form, image: emoji })}
                    className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center ${
                      form.image === emoji
                        ? 'bg-blue-100 ring-2 ring-blue-600'
                        : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">عنوان الإعلان *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">التصنيف *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {allCategoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value={CUSTOM_CATEGORY_VALUE}>+ إضافة تصنيف جديد غير موجود...</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">المحافظة *</label>
                <select
                  required
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {EGYPT_GOVERNORATES.map((gov) => (
                    <option key={gov} value={gov}>
                      {gov}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {form.category === CUSTOM_CATEGORY_VALUE && (
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1">
                <label className="block text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-blue-700" />
                  اسم التصنيف الجديد *
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={form.custom_category}
                  onChange={(e) => setForm({ ...form, custom_category: e.target.value })}
                  placeholder="اكتب التصنيف الجديد..."
                  className="w-full px-3.5 py-2 border border-blue-200 rounded-xl bg-white text-sm"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  السعر بالجنيه المصري (اختياري)
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm tabular-nums outline-none focus:ring-2 focus:ring-blue-600"
                />
                <label className="inline-flex items-center gap-2 mt-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.price_negotiable}
                    onChange={(e) => setForm({ ...form, price_negotiable: e.target.checked })}
                  />
                  قابل للتفاوض
                </label>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الحالة</label>
                <select
                  value={form.item_condition}
                  onChange={(e) =>
                    setForm({ ...form, item_condition: e.target.value as ItemCondition })
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="unspecified">غير محدد</option>
                  <option value="new">جديد</option>
                  <option value="used">مستعمل</option>
                </select>
              </div>
            </div>

            <CategorySpecsFields
              category={resolvedCategory}
              specs={form.specs}
              onChange={(nextSpecs) => setForm({ ...form, specs: nextSpecs })}
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">وصف الإعلان *</label>
              <textarea
                rows={4}
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm resize-none outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <AdImageUploader
              imageUrl={form.image_url}
              extraImages={form.extra_images}
              maxImages={maxImages}
              onChange={(mainUrl, extras) =>
                setForm((prev) => ({ ...prev, image_url: mainUrl, extra_images: extras }))
              }
            />

            <GoogleMapLocationPicker
              latitude={form.latitude}
              longitude={form.longitude}
              locationAddress={form.location_address}
              onChange={({ latitude, longitude, locationAddress }) =>
                setForm((prev) => ({
                  ...prev,
                  latitude,
                  longitude,
                  location_address: locationAddress,
                }))
              }
            />

            <div className="flex gap-2.5 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm"
              >
                {saving ? 'جاري حفظ التعديل...' : 'حفظ التعديل الوحيد'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
