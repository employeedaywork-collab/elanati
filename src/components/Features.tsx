export default function Features() {
  const features = [
    { icon: '🎯', title: 'استهداف دقيق', description: 'وصول مباشر للموزعين والتجار المهتمين بنوع منتجاتك وخدماتك' },
    { icon: '⚡', title: 'نشر فوري', description: 'انشر إعلانك في دقائق معدودة وابدأ في استقبال الطلبات فوراً' },
    { icon: '📊', title: 'تقارير وإحصائيات', description: 'تابع أداء إعلاناتك مع تقارير مفصلة عن المشاهدات والتفاعلات' },
    { icon: '🌍', title: 'تغطية شاملة', description: 'وصل إلى تجار وموزعين في جميع محافظات مصر من الإسكندرية إلى أسوان' },
    { icon: '💰', title: 'أسعار تنافسية', description: 'باقات مرنة تناسب جميع الميزانيات مع قيمة عالية مقابل الاستثمار' },
    { icon: '🔒', title: 'موثوق وأمان', description: 'بيئة آمنة وموثوقة مع التحقق من جميع المعلنين والتجار' }
  ];
  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-medium mb-4">لماذا تختارنا؟</span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">مميزات تجعلنا الخيار الأول</h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">نوفر لك أدوات متكاملة لنشر إعلاناتك والوصول إلى الجمهور المناسب</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="group p-8 rounded-2xl border border-gray-100 hover:border-blue-200 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
              <span className="text-4xl mb-4 block group-hover:scale-110 transition-transform duration-300">{feature.icon}</span>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}