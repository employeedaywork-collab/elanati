import { AdCategory } from '../types';

interface HeroProps {
  onAddAd: () => void;
  onSelectCategory: (category: AdCategory | 'الكل') => void;
}

export default function Hero({ onAddAd, onSelectCategory }: HeroProps) {
  const quickCategories: { icon: string; label: string; category: AdCategory | 'الكل' }[] = [
    { icon: '📦', label: 'إعلانات التوزيع', category: 'توزيع' },
    { icon: '💼', label: 'فرص التجارة والجملة', category: 'تجارة' },
    { icon: '🏪', label: 'المحلات التجارية', category: 'محلات' },
    { icon: '🔍', label: 'جميع التصنيفات', category: 'الكل' },
  ];

  const handleCategoryJump = (cat: AdCategory | 'الكل') => {
    onSelectCategory(cat);
    const el = document.getElementById('ads');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      id="home"
      className="relative min-h-[86vh] flex items-center justify-center overflow-hidden pt-24 pb-28 bg-slate-950"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-16 right-16 w-80 h-80 bg-blue-500 rounded-full filter blur-3xl animate-float" />
          <div
            className="absolute bottom-16 left-20 w-80 h-80 bg-indigo-500 rounded-full filter blur-3xl animate-float"
            style={{ animationDelay: '1.5s' }}
          />
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-blue-200 text-sm md:text-base font-medium mb-4 animate-fade-in-up">
          منصة الإعلانات المتخصصة للموزعين والتجار في جمهورية مصر العربية
        </p>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6 animate-fade-in-up-delay-1 leading-tight max-w-4xl mx-auto [text-wrap:balance]">
          أوصل إعلانك لآلاف{' '}
          <span className="text-amber-400">الموزعين والتجار</span> في جميع المحافظات
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-slate-200 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up-delay-2">
          انشر عروض الجملة والتوزيع والمحلات التجارية في دقائق، وتواصل مباشرة مع التجار المهتمين وإدارة المنصة دون وسطاء.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up-delay-3">
          <button
            type="button"
            onClick={onAddAd}
            className="w-full sm:w-auto bg-amber-400 hover:bg-amber-300 text-slate-950 px-8 py-4 rounded-xl font-extrabold text-base md:text-lg transition-colors whitespace-nowrap shrink-0 shadow-lg shadow-amber-500/20"
          >
            أضف إعلانك الآن
          </button>
          <a
            href="#ads"
            className="w-full sm:w-auto bg-white/10 hover:bg-white/15 border border-white/25 text-white px-8 py-4 rounded-xl font-bold text-base md:text-lg transition-colors whitespace-nowrap shrink-0"
          >
            تصفح الإعلانات المتاحة
          </a>
        </div>

        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {quickCategories.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleCategoryJump(item.category)}
              className="bg-white/10 hover:bg-white/15 border border-white/15 rounded-2xl p-4 text-center transition-colors cursor-pointer group focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <span className="text-2xl mb-2 block" aria-hidden="true">
                {item.icon}
              </span>
              <span className="text-white text-sm font-semibold group-hover:text-amber-300 transition-colors">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
