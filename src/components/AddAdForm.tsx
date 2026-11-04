import { useState } from 'react';

interface AddAdFormProps { onSubmit: (ad: any) => void; onClose: () => void; }

export default function AddAdForm({ onSubmit, onClose }: AddAdFormProps) {
  const [formData, setFormData] = useState({ title: '', category: 'توزيع', description: '', contact: '', city: '', image: '📦' });
  const emojis = ['📦', '💻', '👔', '💄', '🪑', '🏗️', '🍕', '🚗', '📱', '🏠', '💊', '🎁'];
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(formData); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-gray-100 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">أضف إعلانك</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">اختر أيقونة لإعلانك</label>
            <div className="flex flex-wrap gap-2">
              {emojis.map((emoji) => (
                <button key={emoji} type="button" onClick={() => setFormData({ ...formData, image: emoji })} className={`w-12 h-12 rounded-xl text-2xl flex items-center justify-center transition-all ${formData.image === emoji ? 'bg-blue-100 ring-2 ring-blue-500 scale-110' : 'bg-gray-50 hover:bg-gray-100'}`}>{emoji}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">عنوان الإعلان *</label>
            <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="مثال: توزيع مواد غذائية بالجملة" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">التصنيف *</label>
            <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white">
              <option value="توزيع">توزيع</option>
              <option value="تجارة">تجارة</option>
              <option value="محلات">محلات تجارية</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">وصف الإعلان *</label>
            <textarea required rows={4} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="اكتب وصفاً تفصيلياً لإعلانك..." className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">المحافظة *</label>
            <select required value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white">
              <option value="">اختر المحافظة</option>
              <option value="القاهرة">القاهرة</option><option value="الجيزة">الجيزة</option><option value="الإسكندرية">الإسكندرية</option>
              <option value="الدقهلية">الدقهلية</option><option value="الشرقية">الشرقية</option><option value="القليوبية">القليوبية</option>
              <option value="الغربية">الغربية</option><option value="المنوفية">المنوفية</option><option value="البحيرة">البحيرة</option>
              <option value="كفر الشيخ">كفر الشيخ</option><option value="دمياط">دمياط</option><option value="بورسعيد">بورسعيد</option>
              <option value="الإسماعيلية">الإسماعيلية</option><option value="السويس">السويس</option><option value="الفيوم">الفيوم</option>
              <option value="بني سويف">بني سويف</option><option value="المنيا">المنيا</option><option value="أسيوط">أسيوط</option>
              <option value="سوهاج">سوهاج</option><option value="قنا">قنا</option><option value="الأقصر">الأقصر</option><option value="أسوان">أسوان</option>
              <option value="البحر الأحمر">البحر الأحمر</option><option value="الوادي الجديد">الوادي الجديد</option>
              <option value="مطروح">مطروح</option><option value="شمال سيناء">شمال سيناء</option><option value="جنوب سيناء">جنوب سيناء</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">رقم التواصل *</label>
            <input type="tel" required value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} placeholder="01xxxxxxxxx" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
          </div>
          <button type="submit" className="w-full bg-gradient-to-l from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300">نشر الإعلان 🚀</button>
        </form>
      </div>
    </div>
  );
}