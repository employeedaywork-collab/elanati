import { useState } from 'react';

export default function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    setFormData({ name: '', email: '', phone: '', message: '' });
  };
  return (
    <section id="contact" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <span className="inline-block px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-medium mb-4">تواصل معنا</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">هل لديك استفسار؟<br /><span className="bg-clip-text text-transparent bg-gradient-to-l from-blue-600 to-purple-600">نحن هنا لمساعدتك</span></h2>
            <p className="text-gray-600 text-lg mb-8">فريقنا جاهز للإجابة على جميع استفساراتك ومساعدتك في تحقيق أهدافك الإعلانية</p>
            <div className="space-y-6">
              <div className="flex items-center gap-4"><div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-xl">📧</div><div><h4 className="font-bold text-gray-900">البريد الإلكتروني</h4><p className="text-gray-600">employeedaywork@gmail.com</p></div></div>
              <div className="flex items-center gap-4"><div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-xl">📱</div><div><h4 className="font-bold text-gray-900">الهاتف / واتساب</h4><p className="text-gray-600">01007008707</p></div></div>
              <div className="flex items-center gap-4"><div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-xl">📍</div><div><h4 className="font-bold text-gray-900">الموقع</h4><p className="text-gray-600">جمهورية مصر العربية</p></div></div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-3xl p-8">
            {submitted ? (
              <div className="h-full flex items-center justify-center text-center"><div><span className="text-6xl mb-4 block">✅</span><h3 className="text-2xl font-bold text-gray-900 mb-2">تم الإرسال بنجاح!</h3><p className="text-gray-600">سنتواصل معك في أقرب وقت ممكن</p></div></div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div><label className="block text-sm font-medium text-gray-700 mb-2">الاسم الكامل</label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="أدخل اسمك" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white" /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">البريد الإلكتروني</label><input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="example@email.com" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">رقم الجوال</label><input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="01xxxxxxxxx" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white" /></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-2">رسالتك</label><textarea required rows={5} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} placeholder="اكتب رسالتك هنا..." className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none bg-white" /></div>
                <button type="submit" className="w-full bg-gradient-to-l from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300">إرسال الرسالة 📨</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}