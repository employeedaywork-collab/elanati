export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">جاهز لنشر إعلانك؟</h2>
          <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">انضم لآلاف التجار والموزعين الذين يثقون بمنصتنا لتنمية أعمالهم</p>
          <a href="#home" className="inline-block bg-gradient-to-l from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-blue-500/30 transition-all duration-300 hover:scale-105">ابدأ الآن مجاناً 🚀</a>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4"><div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center"><span className="text-white font-bold text-lg">إ</span></div><span className="text-xl font-bold">إعلاناتي</span></div>
            <p className="text-gray-400 text-sm leading-relaxed">منصة إعلانية متكاملة مخصصة للموزعين والتجار والمحلات التجارية في جمهورية مصر العربية</p>
          </div>
          <div><h4 className="font-bold text-lg mb-4">روابط سريعة</h4><ul className="space-y-3"><li><a href="#home" className="text-gray-400 hover:text-white transition-colors">الرئيسية</a></li><li><a href="#features" className="text-gray-400 hover:text-white transition-colors">المميزات</a></li><li><a href="#packages" className="text-gray-400 hover:text-white transition-colors">الباقات</a></li><li><a href="#ads" className="text-gray-400 hover:text-white transition-colors">الإعلانات</a></li></ul></div>
          <div><h4 className="font-bold text-lg mb-4">التصنيفات</h4><ul className="space-y-3"><li><a href="#ads" className="text-gray-400 hover:text-white transition-colors">توزيع</a></li><li><a href="#ads" className="text-gray-400 hover:text-white transition-colors">تجارة</a></li><li><a href="#ads" className="text-gray-400 hover:text-white transition-colors">محلات تجارية</a></li><li><a href="#ads" className="text-gray-400 hover:text-white transition-colors">عروض وخصومات</a></li></ul></div>
          <div><h4 className="font-bold text-lg mb-4">الدعم</h4><ul className="space-y-3"><li><a href="#contact" className="text-gray-400 hover:text-white transition-colors">تواصل معنا</a></li><li><a href="#" className="text-gray-400 hover:text-white transition-colors">الأسئلة الشائعة</a></li><li><a href="#" className="text-gray-400 hover:text-white transition-colors">سياسة الخصوصية</a></li><li><a href="#" className="text-gray-400 hover:text-white transition-colors">الشروط والأحكام</a></li></ul></div>
        </div>
      </div>
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">© 2024 إعلاناتي. جميع الحقوق محفوظة</p>
            <div className="flex items-center gap-4"><span className="text-gray-500 text-sm">صنع بـ ❤️ في مصر</span></div>
          </div>
        </div>
      </div>
    </footer>
  );
}