import { useState } from 'react';
import { CheckCircle2, MessageCircle, X } from 'lucide-react';
import { formatWhatsAppLink } from '../lib/supabase';
import { createPackageRequest } from '../services/dataService';
import { PackagePlan } from '../types';

interface PackageRequestModalProps {
  pkg: PackagePlan;
  cycle: 'monthly' | 'annual';
  adminWhatsApp: string;
  onClose: () => void;
}

export default function PackageRequestModal({
  pkg,
  cycle,
  adminWhatsApp,
  onClose,
}: PackageRequestModalProps) {
  const [formData, setFormData] = useState({
    client_name: '',
    client_phone: '',
    client_email: '',
    company_name: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const price = cycle === 'annual' ? pkg.annual_price : pkg.monthly_price;
  const cycleLabel = cycle === 'annual' ? 'سنوي' : 'شهري';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (formData.client_phone.replace(/\D/g, '').length < 10) {
      setError('يرجى إدخال رقم هاتف صحيح للتواصل');
      return;
    }
    setSubmitting(true);
    try {
      await createPackageRequest({
        package_name: pkg.name,
        billing_cycle: cycle,
        price_egp: price,
        client_name: formData.client_name,
        client_phone: formData.client_phone,
        client_email: formData.client_email,
        company_name: formData.company_name,
        notes: formData.notes,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تسجيل الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  const whatsappUrl = formatWhatsAppLink(
    adminWhatsApp,
    `مرحباً إدارة منصة إعلاناتي، أرغب في الاشتراك في باقة "${pkg.name}" (${cycleLabel} - ${price} جنيه). الاسم: ${formData.client_name || '-'}، الهاتف: ${formData.client_phone || '-'}`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-slate-100 px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">طلب الاشتراك في باقة {pkg.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {price} جنيه مصري · اشتراك {cycleLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5 text-slate-700" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
            <h3 className="text-2xl font-extrabold text-slate-900">تم إرسال طلبك للإدارة بنجاح</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              سيتواصل معك فريق المبيعات خلال وقت قصير لتفعيل باقة <strong>{pkg.name}</strong> على حسابك.
            </p>
            <div className="space-y-2.5 pt-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold text-sm transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                تأكيد سريع عبر واتساب الإدارة
              </a>
              <button
                type="button"
                onClick={onClose}
                className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-xl font-bold text-sm transition-colors"
              >
                العودة للموقع
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">الاسم الكامل *</label>
              <input
                type="text"
                required
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                placeholder="أدخل اسمك"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  value={formData.client_phone}
                  onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                  placeholder="01xxxxxxxxx"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none tabular-nums"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={formData.client_email}
                  onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                  placeholder="example@email.com"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                اسم النشاط التجاري / الشركة (اختياري)
              </label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="مثال: شركة النيل للتوزيع"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                ملاحظات إضافية (اختياري)
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="اذكر أي متطلبات خاصة لحملتك الإعلانية..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white py-3.5 rounded-xl font-bold text-base transition-colors"
            >
              {submitting ? 'جاري تسجيل الطلب...' : 'إرسال طلب الاشتراك'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
