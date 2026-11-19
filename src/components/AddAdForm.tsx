import { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { EGYPT_GOVERNORATES } from '../data/seedData';
import { AdCategory } from '../types';

interface AddAdFormProps {
  requireApproval: boolean;
  onSubmit: (ad: {
    title: string;
    category: AdCategory;
    description: string;
    contact: string;
    city: string;
    image: string;
    image_url?: string;
  }) => Promise<{ requiresReview: boolean }>;
  onClose: () => void;
}

export default function AddAdForm({ requireApproval, onSubmit, onClose }: AddAdFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    category: 'توزيع' as AdCategory,
    description: '',
    contact: '',
    city: '',
    image: '📦',
    image_url: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [doneState, setDoneState] = useState<{ requiresReview: boolean } | null>(null);

  const emojis = ['📦', '💻', '👔', '💄', '🪑', '🏗️', '🍕', '🚗', '📱', '🏠', '💊', '🎁'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (formData.contact.replace(/\D/g, '').length < 10) {
      setError('يرجى إدخال رقم هاتف مصري صحيح (11 رقم)');
      return;
    }
    setSubmitting(true);
    try {
      const result = await onSubmit(formData);
      setDoneState(result);
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
                ? 'تم إرسال إعلانك إلى لوحة إدارة المنصة وسيتم اعتماده ونشره للزوار خلال دقائق.'
                : 'إعلانك ظاهر الآن في قائمة الإعلانات المتاحة لجميع الموزعين والتجار.'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white py-3.5 rounded-xl font-bold text-sm transition-colors"
            >
              إغلاق
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                أيقونة الإعلان
              </label>
              <div className="flex flex-wrap gap-2">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setFormData({ ...formData, image: emoji })}
                    className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center transition-all ${
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
                عنوان الإعلان *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="مثال: توزيع مواد غذائية بالجملة"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
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
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white"
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
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white"
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
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                وصف الإعلان *
              </label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="اكتب تفاصيل المنتجات أو الخدمات وشروط التوزيع..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none resize-none"
              />
            </div>

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
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none tabular-nums"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                رابط صورة للمنتج أو المحل (اختياري)
              </label>
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://example.com/product.jpg"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-left"
                dir="ltr"
              />
            </div>

            {requireApproval && (
              <p className="text-xs text-slate-500">
                سيتم مراجعة الإعلان من إدارة المنصة واعتماده للظهور للزوار خلال وقت قصير.
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white py-3.5 rounded-xl font-bold text-base transition-colors"
            >
              {submitting ? 'جاري الإرسال...' : 'إرسال الإعلان'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
