export default function Features() {
  const features = [
    {
      num: '01',
      title: 'استهداف دقيق للموزعين والتجار',
      description: 'وصول مباشر لشبكة تجار الجملة والموزعين والمحلات المهتمين بنوع منتجاتك وخدماتك.',
    },
    {
      num: '02',
      title: 'نشر ومراجعة سريعة',
      description: 'أضف إعلانك خلال دقائق مع مراجعة جودة من إدارة المنصة لضمان موثوقية العروض.',
    },
    {
      num: '03',
      title: 'تغطية شاملة لجميع المحافظات',
      description: 'انتشر في 27 محافظة مصرية من الإسكندرية والدلتا حتى القاهرة والصعيد.',
    },
    {
      num: '04',
      title: 'تواصل مباشر مع الإدارة والعملاء',
      description: 'قنوات تواصل موثقة عبر الهاتف والواتساب ونظام تذاكر متابعة داخل المنصة.',
    },
    {
      num: '05',
      title: 'إحصائيات ومشاهدات حقيقية',
      description: 'تابع عدد مشاهدات إعلانك وتفاعل التجار معه بشفافية كاملة.',
    },
    {
      num: '06',
      title: 'باقات مرنة لجميع الأنشطة',
      description: 'خيارات تبدأ من الإعلان المجاني وحتى باقات الشركات والموزعين المميزين.',
    },
  ];

  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 max-w-2xl mx-auto">
          <p className="text-blue-700 text-sm font-bold mb-2">لماذا تختار إعلاناتي</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 [text-wrap:balance]">
            أدوات عملية مصممة لنمو مبيعات التجار والموزعين
          </h2>
          <p className="text-slate-600 text-base md:text-lg leading-relaxed">
            نوفر بيئة موثوقة ومنظمة تربط الموردين والموزعين بأصحاب المحلات والتجار في مصر
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.num}
              className="p-7 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-blue-300 transition-colors"
            >
              <span className="text-sm font-extrabold text-blue-700 tabular-nums block mb-3">
                {feature.num}.
              </span>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-slate-600 text-sm md:text-base leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
