import { useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  MessageCircle,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react';
import { formatWhatsAppLink } from '../lib/supabase';
import { createPackageRequest } from '../services/dataService';
import { PackagePlan, PaymentMethod, SiteSettings } from '../types';

interface PackageRequestModalProps {
  pkg: PackagePlan;
  cycle: 'monthly' | 'annual';
  settings: SiteSettings;
  onClose: () => void;
  onOpenPortal: (subscriptionCode: string) => void;
}

export default function PackageRequestModal({
  pkg,
  cycle,
  settings,
  onClose,
  onOpenPortal,
}: PackageRequestModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('vodafone_cash');
  const [formData, setFormData] = useState({
    client_name: '',
    client_phone: '',
    client_email: '',
    company_name: '',
    payment_reference: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copiedTarget, setCopiedTarget] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const unitPrice = cycle === 'annual' ? pkg.annual_price : pkg.monthly_price;
  const totalEgp = cycle === 'annual' ? unitPrice * 12 : unitPrice;
  const cycleLabel = cycle === 'annual' ? 'سنوي (365 يوم)' : 'شهري (30 يوم)';

  const paymentOptions: {
    id: PaymentMethod;
    title: string;
    subtitle: string;
    targetLabel: string;
    targetValue: string;
    icon: typeof Wallet;
  }[] = [
    {
      id: 'vodafone_cash',
      title: 'فودافون كاش / محافظ إلكترونية',
      subtitle: 'فودافون كاش · أورنج كاش · اتصالات كاش',
      targetLabel: 'رقم المحفظة للتحويل',
      targetValue: settings.vodafone_cash_number || settings.contact_phone,
      icon: Wallet,
    },
    {
      id: 'instapay',
      title: 'إنستاباي (InstaPay)',
      subtitle: 'تحويل لحظي عبر تطبيق إنستاباي بالجنيه المصري',
      targetLabel: 'حساب / رقم إنستاباي',
      targetValue: settings.instapay_handle || settings.contact_phone,
      icon: Smartphone,
    },
    {
      id: 'bank_transfer',
      title: 'تحويل بنكي',
      subtitle: 'إيداع أو تحويل بنكي بالجنيه المصري',
      targetLabel: 'بيانات الحساب البنكي',
      targetValue: settings.bank_account_info || settings.contact_phone,
      icon: Building2,
    },
  ];

  const activePayment = paymentOptions.find((p) => p.id === paymentMethod) || paymentOptions[0];

  const handleCopy = async (value: string, type: 'target' | 'code') => {
    try {
      await navigator.clipboard.writeText(value);
      if (type === 'target') {
        setCopiedTarget(true);
        setTimeout(() => setCopiedTarget(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (formData.client_phone.replace(/\D/g, '').length < 10) {
      setError('يرجى إدخال رقم هاتف صحيح للتواصل وتفعيل الاشتراك');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createPackageRequest({
        package_name: pkg.name,
        billing_cycle: cycle,
        price_egp: totalEgp,
        payment_method: paymentMethod,
        payment_reference: formData.payment_reference,
        client_name: formData.client_name,
        client_phone: formData.client_phone,
        client_email: formData.client_email,
        company_name: formData.company_name,
        notes: formData.notes,
      });

      const subCode = created.subscription_code || '';
      try {
        if (subCode) localStorage.setItem('elanati_last_sub_code', subCode);
        localStorage.setItem('elanati_last_client_phone', formData.client_phone.trim());
      } catch {
        // ignore
      }
      setCreatedCode(subCode);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تسجيل الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  const whatsappUrl = formatWhatsAppLink(
    settings.whatsapp_number,
    `مرحباً إدارة منصة إعلاناتي، قمت بطلب الاشتراك في باقة "${pkg.name}" (${cycleLabel}) بمبلغ ${totalEgp} جنيه مصري عبر ${activePayment.title}. كود الاشتراك: ${createdCode || '-'}، مرجع التحويل: ${formData.payment_reference || '-'}، الاسم: ${formData.client_name || '-'}`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-slate-100 px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              الاشتراك في باقة {pkg.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              الإجمالي المطلوب: {totalEgp.toLocaleString('en-US')} جنيه مصري · اشتراك {cycleLabel}
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

        {createdCode ? (
          <div className="p-8 text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
            <h3 className="text-2xl font-extrabold text-slate-900">تم تسجيل طلب الاشتراك بنجاح</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              احتفظ بكود الاشتراك التالي لمتابعة حالة التفعيل وتاريخ البداية والنهاية والعدّاد التنازلي لباقة{' '}
              <strong>{pkg.name}</strong>:
            </p>

            <div className="inline-flex items-center gap-3 bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl">
              <span className="text-xl font-extrabold text-blue-700 tabular-nums tracking-wide">
                {createdCode}
              </span>
              <button
                type="button"
                onClick={() => void handleCopy(createdCode, 'code')}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copiedCode ? 'تم النسخ' : 'نسخ'}
              </button>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPortal(createdCode);
                }}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white py-3.5 rounded-xl font-bold text-sm transition-colors"
              >
                متابعة الدفع والاشتراك داخل المنصة الآن
              </button>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 py-3 rounded-xl font-bold text-xs transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                إرسال الإيصال عبر واتساب (اختياري)
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
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                {error}
              </div>
            )}

            {/* Payment Method Selector (EGP) */}
            <div className="space-y-3">
              <label className="block text-sm font-extrabold text-slate-900">
                اختر طريقة السداد بالجنيه المصري
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {paymentOptions.map((opt) => {
                  const Icon = opt.icon;
                  const active = paymentMethod === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPaymentMethod(opt.id)}
                      className={`text-right p-3 rounded-2xl border transition-all ${
                        active
                          ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mb-1.5 ${active ? 'text-blue-700' : 'text-slate-500'}`} />
                      <p className="text-xs font-extrabold text-slate-900 leading-snug">{opt.title}</p>
                    </button>
                  );
                })}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500">{activePayment.targetLabel}</p>
                    <p className="text-base font-extrabold text-slate-900 tabular-nums mt-0.5">
                      {activePayment.targetValue}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopy(activePayment.targetValue, 'target')}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 shrink-0"
                  >
                    {copiedTarget ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copiedTarget ? 'تم النسخ' : 'نسخ'}
                  </button>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  المطلوب تحويل <strong className="text-blue-700 tabular-nums">{totalEgp.toLocaleString('en-US')} جنيه مصري</strong>.{' '}
                  {settings.payment_instructions}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  placeholder="أدخل اسمك"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  value={formData.client_phone}
                  onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                  placeholder="01xxxxxxxxx"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none tabular-nums text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  رقم المحفظة المحوّل منها / رقم العملية
                </label>
                <input
                  type="text"
                  value={formData.payment_reference}
                  onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
                  placeholder="مثال: 010xxxxxxxx أو رقم المرجع"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none tabular-nums text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  اسم النشاط التجاري / الشركة
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="مثال: شركة النيل للتوزيع"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                البريد الإلكتروني (اختياري)
              </label>
              <input
                type="email"
                value={formData.client_email}
                onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                placeholder="example@email.com"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                ملاحظات إضافية (اختياري)
              </label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="أي تفاصيل خاصة بطلب الاشتراك أو الحملة..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none resize-none text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white py-3.5 rounded-xl font-bold text-base transition-colors"
            >
              {submitting ? 'جاري تسجيل الطلب...' : 'تأكيد طلب الاشتراك واستلام الكود'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
