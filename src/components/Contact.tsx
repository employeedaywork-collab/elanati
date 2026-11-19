import { useState } from 'react';
import { CheckCircle2, Copy, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { formatWhatsAppLink } from '../lib/supabase';
import { createContactTicket } from '../services/dataService';
import { SiteSettings } from '../types';

interface ContactProps {
  settings: SiteSettings;
  onTicketCreated: (ticketCode: string) => void;
}

export default function Contact({ settings, onTicketCreated }: ContactProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'استفسار عام',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdTicketCode, setCreatedTicketCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const ticket = await createContactTicket({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        subject: formData.subject,
        message: formData.message,
      });
      setCreatedTicketCode(ticket.ticket_code);
      try {
        localStorage.setItem('elanati_last_ticket_code', ticket.ticket_code);
        localStorage.setItem('elanati_last_client_name', formData.name.trim());
      } catch {
        // ignore storage errors
      }
      setFormData({ name: '', email: '', phone: '', subject: 'استفسار عام', message: '' });
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال الرسالة حالياً، يرجى المحاولة لاحقاً');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!createdTicketCode) return;
    try {
      await navigator.clipboard.writeText(createdTicketCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <section id="contact" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <p className="text-blue-700 text-sm font-bold mb-2">تواصل مباشر مع الإدارة</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-5 [text-wrap:balance]">
              هل لديك استفسار أو طلب خاص؟ نحن هنا لمساعدتك
            </h2>
            <p className="text-slate-600 text-base md:text-lg mb-8 leading-relaxed">
              تصل رسالتك مباشرة إلى لوحة تحكم مدير المنصة، مع إعطائك رقم متابعة فوري لقراءة الردود والتواصل المباشر.
            </p>

            <div className="space-y-5">
              <a
                href={`mailto:${settings.contact_email}`}
                className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 hover:border-blue-300 transition-colors"
              >
                <div className="w-11 h-11 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">البريد الإلكتروني</h4>
                  <p className="text-slate-600 text-sm">{settings.contact_email}</p>
                </div>
              </a>

              <a
                href={`tel:${settings.contact_phone}`}
                className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 hover:border-blue-300 transition-colors"
              >
                <div className="w-11 h-11 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">الهاتف المباشر</h4>
                  <p className="text-slate-600 text-sm tabular-nums">{settings.contact_phone}</p>
                </div>
              </a>

              <a
                href={formatWhatsAppLink(
                  settings.whatsapp_number,
                  'مرحباً إدارة منصة إعلاناتي، لدي استفسار بخصوص المنصة'
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 transition-colors"
              >
                <div className="w-11 h-11 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">واتساب الإدارة الفوري</h4>
                  <p className="text-slate-600 text-sm tabular-nums">
                    محادثة مباشرة عبر واتساب ({settings.contact_phone})
                  </p>
                </div>
              </a>

              <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 bg-slate-50/70">
                <div className="w-11 h-11 bg-slate-200/70 text-slate-700 rounded-xl flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">نطاق التغطية</h4>
                  <p className="text-slate-600 text-sm">{settings.location_text}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 border border-slate-200">
            {createdTicketCode ? (
              <div className="py-10 text-center space-y-4">
                <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
                <h3 className="text-2xl font-extrabold text-slate-900">تم استلام رسالتك بنجاح</h3>
                <p className="text-slate-600 text-sm max-w-md mx-auto">
                  احتفظ برقم المتابعة التالي لمتابعة رد مدير المنصة ومحادثته مباشرة في أي وقت:
                </p>

                <div className="inline-flex items-center gap-3 bg-white border border-slate-200 px-5 py-3 rounded-2xl">
                  <span className="text-xl font-extrabold text-blue-700 tabular-nums tracking-wide">
                    {createdTicketCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                  >
                    <Copy className="w-4 h-4" />
                    {copied ? 'تم النسخ' : 'نسخ'}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-3">
                  <button
                    type="button"
                    onClick={() => onTicketCreated(createdTicketCode)}
                    className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors"
                  >
                    افتح محادثة المتابعة الآن
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatedTicketCode(null)}
                    className="border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-bold text-sm transition-colors"
                  >
                    إرسال رسالة أخرى
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-xl font-extrabold text-slate-900 mb-2">أرسل رسالة للإدارة</h3>

                {error && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    الاسم الكامل *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="أدخل اسمك"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      البريد الإلكتروني *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="example@email.com"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      رقم الجوال / الواتساب
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="01xxxxxxxxx"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-600 outline-none tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">الموضوع</label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-600 outline-none"
                  >
                    <option value="استفسار عام">استفسار عام</option>
                    <option value="طلب تمييز إعلان">طلب تمييز إعلان</option>
                    <option value="الاشتراك في الباقات">الاشتراك في الباقات</option>
                    <option value="مشكلة تقنية أو شكوى">مشكلة تقنية أو شكوى</option>
                    <option value="شراكة تجارية">شراكة تجارية</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">رسالتك *</label>
                  <textarea
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="اكتب رسالتك هنا بالتفصيل..."
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-600 outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white py-3.5 rounded-xl font-bold text-base transition-colors"
                >
                  {submitting ? 'جاري الإرسال...' : 'إرسال الرسالة للإدارة'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
