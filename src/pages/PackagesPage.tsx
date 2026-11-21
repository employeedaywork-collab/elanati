import { Link } from 'react-router-dom';
import { ArrowLeft, Receipt } from 'lucide-react';
import Packages from '../components/Packages';
import { usePublicContext } from '../components/PublicLayout';

export default function PackagesPage() {
  const { packages, onSelectPackage } = usePublicContext();

  return (
    <div className="pt-16">
      <Packages packages={packages} onSelectPackage={onSelectPackage} />
      <section className="py-12 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">لديك اشتراك أو دفعة بالفعل؟</h3>
              <p className="text-xs text-slate-600">
                راجع سجل مدفوعاتك والعدّاد التنازلي المتبقي لاشتراكك من قسم الاشتراكات.
              </p>
            </div>
          </div>
          <Link
            to="/subscriptions"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-colors shrink-0"
          >
            الانتقال لقسم الاشتراكات
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
