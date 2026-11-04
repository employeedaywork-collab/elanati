import { useState } from 'react';

interface PackageProps { onAddAd: () => void; }

export default function Packages({ onAddAd }: PackageProps) {
  const [isAnnual, setIsAnnual] = useState(false);
  const packages = [
    { name: 'مجاني', price: '0', period: 'شهرياً', description: 'مثالي للبدء والتجربة', features: ['إعلان واحد فقط', 'ظهور لمدة 7 أيام', 'تصنيف أساسي', 'دعم عبر البريد'], popular: false, cta: 'ابدأ مجاناً' },
    { name: 'الاحترافي', price: isAnnual ? '199' : '249', period: isAnnual ? 'سنوياً' : 'شهرياً', description: 'الأكثر شعبية بين التجار', features: ['حتى 10 إعلانات', 'ظهور لمدة 30 يوم', 'إعلان مميز (نجمي)', 'تقارير أداء مفصلة', 'دعم أولوية', 'صور إضافية'], popular: true, cta: 'اشترك الآن' },
    { name: 'المؤسسي', price: isAnnual ? '499' : '599', period: isAnnual ? 'سنوياً' : 'شهرياً', description: 'للموزعين والشركات الكبيرة', features: ['إعلانات غير محدودة', 'ظهور دائم', 'إعلان مميز + بانر', 'تقارير متقدمة + API', 'مدير حساب خاص', 'أولوية في الظهور', 'حملات إعلانية مخصصة'], popular: false, cta: 'تواصل معنا' }
  ];
  return (
    <section id="packages" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-purple-50 text-purple-600 rounded-full text-sm font-medium mb-4">الباقات والأسعار</span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">اختر الباقة المناسبة لك</h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto mb-8">باقات مرنة تناسب جميع الاحتياجات والميزانيات</p>
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-medium ${!isAnnual ? 'text-blue-600' : 'text-gray-500'}`}>شهري</span>
            <button onClick={() => setIsAnnual(!isAnnual)} className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${isAnnual ? 'bg-blue-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow ${isAnnual ? 'right-1' : 'right-8'}`}></span>
            </button>
            <span className={`text-sm font-medium ${isAnnual ? 'text-blue-600' : 'text-gray-500'}`}>سنوي <span className="text-green-500 text-xs">وفّر 20%</span></span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {packages.map((pkg, index) => (
            <div key={index} className={`relative rounded-3xl p-8 transition-all duration-300 hover:scale-105 hover:shadow-2xl ${pkg.popular ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-2xl shadow-blue-500/30 scale-105' : 'bg-white border border-gray-200 hover:border-blue-200'}`}>
              {pkg.popular && <div className="absolute -top-4 left-1/2 -translate-x-1/2"><span className="bg-gradient-to-l from-yellow-400 to-orange-400 text-gray-900 px-4 py-1.5 rounded-full text-sm font-bold">⭐ الأكثر طلباً</span></div>}
              <h3 className={`text-xl font-bold mb-2 ${pkg.popular ? 'text-white' : 'text-gray-900'}`}>{pkg.name}</h3>
              <p className={`text-sm mb-6 ${pkg.popular ? 'text-blue-100' : 'text-gray-500'}`}>{pkg.description}</p>
              <div className="mb-6">
                <span className={`text-5xl font-bold ${pkg.popular ? 'text-white' : 'text-gray-900'}`}>{pkg.price}</span>
                <span className={`text-sm mr-1 ${pkg.popular ? 'text-blue-100' : 'text-gray-500'}`}>جنيه / {pkg.period}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {pkg.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <svg className={`w-5 h-5 flex-shrink-0 ${pkg.popular ? 'text-blue-200' : 'text-green-500'}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    <span className={`text-sm ${pkg.popular ? 'text-blue-50' : 'text-gray-600'}`}>{feature}</span>
                  </li>
                ))}
              </ul>
              <button onClick={onAddAd} className={`w-full py-3 rounded-xl font-bold transition-all duration-300 ${pkg.popular ? 'bg-white text-blue-600 hover:shadow-lg' : 'bg-gradient-to-l from-blue-600 to-purple-600 text-white hover:shadow-lg hover:shadow-blue-500/30'}`}>{pkg.cta}</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}