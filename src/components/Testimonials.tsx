export default function Testimonials() {
  const testimonials = [
    { name: 'أحمد محمود', role: 'موزع مواد غذائية', city: 'القاهرة', text: 'منصة ممتازة! حصلت على عقود توزيع جديدة خلال أسبوع واحد من نشر إعلاني. أنصح بها كل موزع.', rating: 5, avatar: '👨‍💼' },
    { name: 'سارة أحمد', role: 'صاحبة محل ملابس', city: 'الإسكندرية', text: 'المنصة سهلت علي الوصول لعملاء جدد بشكل كبير. الإعلانات سهلة النشر والنتائج مذهلة.', rating: 5, avatar: '👩‍💼' },
    { name: 'محمد علي', role: 'مدير مبيعات', city: 'المنصورة', text: 'أفضل منصة إعلانية مخصصة للتجار والموزعين في مصر. الدعم الفني ممتاز والأسعار معقولة جداً.', rating: 5, avatar: '👨‍💻' }
  ];
  return (
    <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-yellow-50 text-yellow-600 rounded-full text-sm font-medium mb-4">آراء عملائنا</span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">ماذا يقول عملاؤنا عنا؟</h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">آلاف التجار والموزعين في مصر يثقون بمنصتنا لنمو أعمالهم</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100">
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => <span key={i} className="text-yellow-400 text-xl">⭐</span>)}
              </div>
              <p className="text-gray-600 leading-relaxed mb-6 text-lg">"{testimonial.text}"</p>
              <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
                <span className="text-3xl">{testimonial.avatar}</span>
                <div><h4 className="font-bold text-gray-900">{testimonial.name}</h4><p className="text-sm text-gray-500">{testimonial.role} - {testimonial.city}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}