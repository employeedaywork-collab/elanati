import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { AdCategory, SiteSettings } from '../types';

interface FooterProps {
  settings: SiteSettings;
  onAddAd: () => void;
  onOpenPortal?: () => void;
}

type InfoModalType = 'faq' | 'privacy' | 'terms' | null;

export default function Footer({ settings, onAddAd, onOpenPortal }: FooterProps) {
  const [infoModal, setInfoModal] = useState<InfoModalType>(null);
  const navigate = useNavigate();

  const handleCategoryClick = (category: AdCategory) => {
    navigate(`/ads?category=${encodeURIComponent(category)}`);
  };

  return (
    <>
      <footer className="bg-slate-950 text-white">
        <div className="border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center">
            <h2 className="text-2xl md:text-3xl font-extrabold mb-3">
              جاهز لنشر إعلانك والوصول للموزعين؟
            </h2>
            <p className="text-slate-400 text-base mb-7 max-w-xl mx-auto">
              انضم للتجار والموزعين في جميع محافظات مصر وابدأ باستقبال طلبات العملاء اليوم.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onAddAd}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-8 py-3.5 rounded-xl font-extrabold text-base transition-colors"
              >
                أضف إعلانك الآن
              </button>
              {onOpenPortal && (
                <button
                  type="button"
                  onClick={onOpenPortal}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-7 py-3.5 rounded-xl font-bold text-base transition-colors"
                >
                  متابعة اشتراكي وإعلاناتي
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-extrabold mb-3">{settings.site_name}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                منصة إعلانية متكاملة مخصصة للموزعين والتجار والمحلات التجارية في {settings.location_text}.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-base mb-4">روابط سريعة</h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/" className="text-slate-400 hover:text-white transition-colors">
                    الرئيسية
                  </Link>
                </li>
                <li>
                  <Link to="/features" className="text-slate-400 hover:text-white transition-colors">
                    المميزات
                  </Link>
                </li>
                <li>
                  <Link to="/packages" className="text-slate-400 hover:text-white transition-colors">
                    الباقات والأسعار
                  </Link>
                </li>
                <li>
                  <Link to="/subscriptions" className="text-slate-400 hover:text-white transition-colors">
                    قسم الاشتراكات والدفعات
                  </Link>
                </li>
                <li>
                  <Link to="/ads" className="text-slate-400 hover:text-white transition-colors">
                    تصفح الإعلانات
                  </Link>
                </li>
                {onOpenPortal && (
                  <li>
                    <button
                      type="button"
                      onClick={onOpenPortal}
                      className="text-blue-300 hover:text-white font-semibold transition-colors"
                    >
                      متابعة اشتراكي والعدّاد التنازلي
                    </button>
                  </li>
                )}
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-base mb-4">التصنيفات</h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => handleCategoryClick('توزيع')}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    توزيع
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleCategoryClick('تجارة')}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    تجارة وجملة
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleCategoryClick('محلات')}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    محلات تجارية
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-base mb-4">الدعم والمساعدة</h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/contact" className="text-slate-400 hover:text-white transition-colors">
                    تواصل معنا
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setInfoModal('faq')}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    الأسئلة الشائعة
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setInfoModal('privacy')}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    سياسة الخصوصية
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setInfoModal('terms')}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    الشروط والأحكام
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} {settings.site_name}. جميع الحقوق محفوظة.</p>
            <p className="tabular-nums">
              {settings.contact_phone} · {settings.contact_email}
            </p>
          </div>
        </div>
      </footer>

      {infoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" onClick={() => setInfoModal(null)} />
          <div className="relative bg-white text-slate-900 rounded-3xl w-full max-w-xl max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-extrabold">
                {infoModal === 'faq' && 'الأسئلة الشائعة'}
                {infoModal === 'privacy' && 'سياسة الخصوصية'}
                {infoModal === 'terms' && 'الشروط والأحكام'}
              </h3>
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                aria-label="إغلاق"
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm text-slate-700 leading-relaxed">
              {infoModal === 'faq' && (
                <>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">كيف أضيف إعلاني على منصة إعلاناتي؟</h4>
                    <p>اضغط على زر "أضف إعلانك" في الأعلى، واختر التصنيف والمحافظة ورقم التواصل، وسيتم مراجعته واعتماده من إدارة المنصة.</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">كيف أتابع ردود إدارة المنصة على استفساري؟</h4>
                    <p>بعد إرسال أي رسالة تحصل على كود متابعة مثل ELN-12345، يمكنك إدخاله في نافذة "تواصل مع الإدارة" أسفل الشاشة لمحادثة المدير مباشرة.</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">كيف أميز إعلاني ليظهر في الصدارة؟</h4>
                    <p>اختر الباقة الاحترافية أو المؤسسية من صفحة الباقات وأرسل طلب التفعيل أو تواصل معنا مباشرة عبر الواتساب.</p>
                  </div>
                </>
              )}
              {infoModal === 'privacy' && (
                <>
                  <p>تلتزم منصة {settings.site_name} بحماية بيانات المعلنين والتجار وعدم مشاركة بيانات التواصل الخاصة بالرسائل والتذاكر مع أي طرف ثالث.</p>
                  <p>أرقام الهواتف المرفقة في الإعلانات المنشورة تظهر للزوار لغرض التواصل التجاري المباشر بين التجار والموزعين فقط.</p>
                </>
              )}
              {infoModal === 'terms' && (
                <>
                  <p>يجب أن تكون جميع الإعلانات المضافة حقيقية ومتوافقة مع القوانين التجارية في جمهورية مصر العربية.</p>
                  <p>تحتفظ إدارة المنصة بحق مراجعة الإعلانات أو رفض أو أرشفة أي إعلان مخالف أو غير دقيق لحماية جودة المنصة.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
