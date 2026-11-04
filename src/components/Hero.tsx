interface HeroProps { onAddAd: () => void; }

export default function Hero({ onAddAd }: HeroProps) {
  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 right-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-float"></div>
          <div className="absolute top-40 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-float" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-20 right-40 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl animate-float" style={{ animationDelay: '2s' }}></div>
        </div>
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="animate-fade-in-up">
          <span className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-blue-200 text-sm font-medium mb-6 border border-white/20">🚀 منصة الإعلانات الأولى للموزعين والتجار في مصر</span>
        </div>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 animate-fade-in-up-delay-1 leading-tight">
          أوصل إعلانك لآلاف<br />
          <span className="bg-gradient-to-l from-yellow-300 to-orange-400 bg-clip-text text-transparent">الموزعين والتجار</span>
        </h1>
        <p className="text-lg md:text-xl text-blue-100 mb-10 max-w-3xl mx-auto animate-fade-in-up-delay-2">منصة متكاملة لنشر إعلاناتك والوصول إلى شبكة واسعة من الموزعين والتجار والمحلات التجارية في جميع أنحاء جمهورية مصر العربية</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up-delay-3">
          <button onClick={onAddAd} className="bg-gradient-to-l from-yellow-400 to-orange-500 text-gray-900 px-8 py-4 rounded-xl font-bold text-lg hover:shadow-2xl transition-all duration-300 hover:scale-105">أضف إعلانك مجاناً ✨</button>
          <a href="#ads" className="bg-white/10 backdrop-blur-sm border border-white/30 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/20 transition-all duration-300">تصفح الإعلانات 🔍</a>
        </div>
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {[{ icon: '📦', label: 'توزيع' }, { icon: '🏪', label: 'محلات تجارية' }, { icon: '🤝', label: 'شراكات' }, { icon: '📈', label: 'نمو الأعمال' }].map((item, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 text-center hover:bg-white/20 transition-all cursor-pointer">
              <span className="text-3xl mb-2 block">{item.icon}</span>
              <span className="text-white text-sm font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}