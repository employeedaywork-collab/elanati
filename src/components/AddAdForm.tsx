import { useEffect, useState } from 'react';
import { CheckCircle2, ImagePlus, Sparkles, X } from 'lucide-react';
import { EGYPT_GOVERNORATES } from '../data/seedData';
import { checkAdAllowance } from '../services/dataService';
import { AdAllowance, AdCategory, SiteSettings } from '../types';

interface AddAdFormProps {
  settings: SiteSettings;
  onSubmit: (ad: {
    client_name: string;
    title: string;
    category: AdCategory;
    description: string;
    contact: string;
    city: string;
    image: string;
    image_url?: string;
    extra_images?: string[];
    banner_url?: string;
    subscription_code?: string;
  }) => Promise<{ requiresReview: boolean }>;
  onClose: () => void;
  onUpgrade: () => void;
  onOpenPortal: (query: string) => void;
}

export default function AddAdForm({
  settings,
  onSubmit,
  onClose,
  onUpgrade,
  onOpenPortal,
}: AddAdFormProps) {
  const [formData, setFormData] = useState(() => {
    let savedName = '';
    let savedPhone = '';
    let savedSubCode = '';
    try {
      savedName = localStorage.getItem('elanati_last_client_name') || '';
      savedPhone = localStorage.getItem('elanati_last_client_phone') || '';
      savedSubCode = localStorage.getItem('elanati_last_sub_code') || '';
    } catch {
      // ignore
    }
    return {
      client_name: savedName,
      title: '',
      category: 'توزيع' as AdCategory,
      description: '',
      contact: savedPhone,
      city: '',
      image: '📦',
      image_url: '',
      extra_images: ['', '', ''],
      banner_url: '',
      subscription_code: savedSubCode,
    };
  });

  const [allowance, setAllowance] = useState<AdAllowance | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [doneState, setDoneState] = useState<{ requiresReview: boolean; phone: string } | null>(null);

  const emojis = ['📦', '💻', '👔', '💄', '🪑', '🏗️', '🍕', '🚗', '📱', '🏠', '💊', '🎁'];

  useEffect(() => {
    const cleanPhone = formData.contact.replace(/\D/g, '');
    const cleanCode = formData.subscription_code.trim();
    if (cleanPhone.length < 10 && !cleanCode) {
      setAllowance(null);
      return;
    }

    const timer = setTimeout(() => {
      void checkAdAllowance(formData.contact, formData.subscription_code).then(setAllowance);
    }, 350);

    return () => clearTimeout(timer);
  }, [formData.contact, formData.subscription_code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.client_name.trim()) {
      setError('يرجى إدخال اسم المعلن أو المسؤول');
      return;
    }
    if (formData.contact.replace(/\D/g, '').length < 10) {
      setError('يرجى إدخال رقم هاتف مصري صحيح (11 رقم)');
      return;
    }
    setSubmitting(true);
    try {
      const result = await onSubmit({
        client_name: formData.client_name.trim(),
        title: formData.title,
        category: formData.category,
        description: formData.description,
        contact: formData.contact,
        city: formData.city,
        image: formData.image,
        image_url: formData.image_url,
        extra_images: formData.extra_images.filter((u) => u.trim()),
        banner_url: formData.banner_url,
        subscription_code: formData.subscription_code || undefined,
      });
      try {
        localStorage.setItem('elanati_last_client_name', formData.client_name.trim());
        localStorage.setItem('elanati_last_client_phone', formData.contact.trim());
        if (formData.subscription_code.trim()) {
          localStorage.setItem('elanati_last_sub_code', formData.subscription_code.trim().toUpperCase());
        }
      } catch {
        // ignore
      }
      setDoneState({ requiresReview: result.requiresReview, phone: formData.contact.trim() });
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء إرسال الإعلان، حاول مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-slate-100 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-extrabold text-slate-900">إضافة إعلان جديد</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5 text-slate-700" />
          </button>
        </div>

        {doneState ? (
          <div className="p-8 text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
            <h3 className="text-2xl font-extrabold text-slate-900">
              {doneState.requiresReview ? 'تم استلام إعلانك للمراجعة' : 'تم نشر إعلانك بنجاح'}
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              {doneState.requiresReview
                ? `تم إرسال إعلانك للمراجعة وسيتم اعتماده ونشره للزوار خلال دقائق. الإعلانات المجانية تظهر لمدة ${settings.free_ad_days || 7} أيام وتختفي تلقائياً بعد انتهاء المدة.`
                : 'إعلانك ظاهر الآن في قائمة الإعلانات المتاحة لجميع الموزعين والتجار.'}
            </p>
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPortal(formData.subscription_code || doneState.phone);
                }}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white py-3.5 rounded-xl font-bold text-sm transition-colors"
              >
                متابعة مدة الإعلان والعدّاد التنازلي
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-xl font-bold text-sm transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
              {allowance ? (
                <div className="space-y-1">
                  <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-700" />
                    الباقة الحالية: {allowance.package_name} (مستخدم {allowance.used_ads} من{' '}
                    {allowance.max_ads >= 999999 ? 'غير محدود' : allowance.max_ads})
                  </p>
                  <p>
                    {allowance.is_permanent
                      ? 'ظهور دائم + أولوية قصوى + بانر إعلاني + صور إضافية.'
                      : `مدة ظهور الإعلان: ${allowance.duration_days} يوماً${
                          allowance.featured ? ' + تمييز نجمي + صور إضافية' : ' ثم يختفي تلقائياً'
                        }.`}
                  </p>
                  {!allowance.allowed && (
                    <div className="pt-1.5 flex items-center justify-between gap-2 text-red-700 font-bold">
                      <span>وصلت للحد الأقصى في باقتك الحالية.</span>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onUpgrade();
                        }}
                        className="px-3 py-1 rounded-lg bg-amber-400 text-slate-950 font-extrabold"
                      >
                        ترقية الباقة
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p>
                  <strong>الباقة المجانية:</strong> إعلان واحد فقط يظهر لمدة{' '}
                  <strong>{settings.free_ad_days || 7} أيام</strong> ويختفي تلقائياً بعد انتهاء الأسبوع.
                  للمزيد من الإعلانات والظهور المميز أدخل كود اشتراكك أو اختر باقة.
                </p>
              )}
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium space-y-2">
                <p>{error}</p>
                {error.includes('الترقية') && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onUpgrade();
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-bold"
                  >
                    عرض الباقات والترقية الآن
                  </button>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">أيقونة الإعلان</label>
              <div className="flex flex-wrap gap-2">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setFormData({ ...formData, image: emoji })}
                    className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                      formData.image === emoji
                        ? 'bg-blue-100 ring-2 ring-blue-600 scale-105'
                        : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                اسم المعلن / المسؤول *
              </label>
              <input
                type="text"
                required
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                placeholder="مثال: أحمد محمود / شركة النيل للتوريدات"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  رقم الهاتف / الواتساب *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  placeholder="01xxxxxxxxx"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none tabular-nums text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  كود الاشتراك المدفوع (إن وُجد)
                </label>
                <input
                  type="text"
                  value={formData.subscription_code}
                  onChange={(e) => setFormData({ ...formData, subscription_code: e.target.value })}
                  placeholder="SUB-XXXXX"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none tabular-nums text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">عنوان الإعلان *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="مثال: توزيع مواد غذائية بالجملة"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">التصنيف *</label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value as AdCategory })
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-sm"
                >
                  <option value="توزيع">توزيع</option>
                  <option value="تجارة">تجارة</option>
                  <option value="محلات">محلات</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">المحافظة *</label>
                <select
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-sm"
                >
                  <option value="">اختر المحافظة</option>
                  {EGYPT_GOVERNORATES.map((gov) => (
                    <option key={gov} value={gov}>
                      {gov}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">وصف الإعلان *</label>
              <textarea
                required
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="اكتب تفاصيل المنتجات أو الخدمات وشروط التوزيع..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none resize-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                رابط الصورة الرئيسية (اختياري)
              </label>
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://example.com/product.jpg"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-left text-sm"
                dir="ltr"
              />
            </div>

            {allowance?.allow_extra_images && (
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2.5">
                <p className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                  <ImagePlus className="w-4 h-4 text-blue-700" />
                  صور إضافية (ميزة باقتك المدفوعة)
                </p>
                {formData.extra_images.map((url, idx) => (
                  <input
                    key={idx}
                    type="url"
                    value={url}
                    onChange={(e) => {
                      const next = [...formData.extra_images];
                      next[idx] = e.target.value;
                      setFormData({ ...formData, extra_images: next });
                    }}
                    placeholder={`رابط صورة إضافية ${idx + 1}`}
                    className="w-full px-3.5 py-2 border border-blue-200 rounded-xl bg-white text-left text-xs outline-none"
                    dir="ltr"
                  />
                ))}
              </div>
            )}

            {allowance?.allow_banner && (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  رابط البانر الإعلاني (ميزة الباقة المؤسسية)
                </label>
                <input
                  type="url"
                  value={formData.banner_url}
                  onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
                  placeholder="https://example.com/banner.jpg"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-left text-sm"
                  dir="ltr"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || (allowance ? !allowance.allowed : false)}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white py-3.5 rounded-xl font-bold text-base transition-colors"
            >
              {submitting ? 'جاري الإرسال...' : 'إرسال الإعلان'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
