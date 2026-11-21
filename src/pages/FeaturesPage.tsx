import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Features from '../components/Features';
import { usePublicContext } from '../components/PublicLayout';

export default function FeaturesPage() {
  const { onAddAd } = usePublicContext();

  return (
    <div className="pt-16">
      <Features />
      <section className="pb-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-slate-900 text-white p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-extrabold mb-2">جاهز للاستفادة من مميزات المنصة؟</h3>
              <p className="text-slate-300 text-sm max-w-xl">
                انشر إعلانك الأول مجاناً أو اختر الباقة الاحترافية للوصول السريع لآلاف التجار والموزعين.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <button
                type="button"
                onClick={onAddAd}
                className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-extrabold transition-colors"
              >
                أضف إعلانك الآن
              </button>
              <Link
                to="/packages"
                className="inline-flex items-center gap-1.5 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors"
              >
                عرض الباقات
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
