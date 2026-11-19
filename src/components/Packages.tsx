import { useState } from 'react';
import { Check } from 'lucide-react';
import { PackagePlan } from '../types';

interface PackagesProps {
  packages: PackagePlan[];
  onSelectPackage: (pkg: PackagePlan, cycle: 'monthly' | 'annual') => void;
}

export default function Packages({ packages, onSelectPackage }: PackagesProps) {
  const [isAnnual, setIsAnnual] = useState(false);
  const activePackages = packages.filter((p) => p.is_active);

  return (
    <section id="packages" className="py-20 bg-slate-50 border-y border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 max-w-2xl mx-auto">
          <p className="text-blue-700 text-sm font-bold mb-2">الباقات والأسعار</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 [text-wrap:balance]">
            اختر الباقة المناسبة لحجم أعمالك
          </h2>
          <p className="text-slate-600 text-base md:text-lg mb-8">
            ابدأ مجاناً أو قم بترقية إعلاناتك للوصول السريع لأكبر عدد من التجار
          </p>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-200/80 rounded-xl">
            <button
              type="button"
              onClick={() => setIsAnnual(false)}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                !isAnnual ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              اشتراك شهري
            </button>
            <button
              type="button"
              onClick={() => setIsAnnual(true)}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                isAnnual ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              اشتراك سنوي (وفر 20%)
            </button>
          </div>
          <p className="text-xs font-semibold text-slate-500 mt-3">
            السداد بالجنيه المصري عبر فودافون كاش · إنستاباي (InstaPay) · التحويل البنكي
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {activePackages.map((pkg) => {
            const price = isAnnual ? pkg.annual_price : pkg.monthly_price;
            const periodLabel = price === 0 ? 'مجاناً' : isAnnual ? 'سنوياً / شهر' : 'شهرياً';

            return (
              <div
                key={pkg.id}
                className={`flex flex-col justify-between rounded-3xl p-8 transition-all ${
                  pkg.popular
                    ? 'bg-slate-900 text-white border-2 border-blue-600 shadow-xl'
                    : 'bg-white text-slate-900 border border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-xl font-extrabold">{pkg.name}</h3>
                    {pkg.popular && (
                      <span className="text-xs font-bold text-amber-400">الأكثر طلباً</span>
                    )}
                  </div>
                  <p className={`text-sm mb-6 ${pkg.popular ? 'text-slate-300' : 'text-slate-600'}`}>
                    {pkg.description}
                  </p>

                  <div className="mb-6 pb-6 border-b border-slate-200/20">
                    <span className="text-4xl md:text-5xl font-extrabold tabular-nums">
                      {price}
                    </span>
                    <span
                      className={`text-sm mr-2 ${pkg.popular ? 'text-slate-300' : 'text-slate-500'}`}
                    >
                      جنيه مصري · {periodLabel}
                    </span>
                    {isAnnual && price > 0 && (
                      <p
                        className={`text-xs font-bold mt-2 tabular-nums ${
                          pkg.popular ? 'text-amber-300' : 'text-blue-700'
                        }`}
                      >
                        الإجمالي السنوي: {(price * 12).toLocaleString('en-US')} جنيه مصري / سنة
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8">
                    {pkg.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-sm">
                        <Check
                          className={`w-5 h-5 shrink-0 mt-0.5 ${
                            pkg.popular ? 'text-amber-400' : 'text-emerald-600'
                          }`}
                        />
                        <span className={pkg.popular ? 'text-slate-200' : 'text-slate-700'}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectPackage(pkg, isAnnual ? 'annual' : 'monthly')}
                  className={`w-full py-3.5 px-5 rounded-xl font-bold text-sm transition-colors whitespace-nowrap ${
                    pkg.popular
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                      : 'bg-blue-700 hover:bg-blue-800 text-white'
                  }`}
                >
                  {pkg.cta_label}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
