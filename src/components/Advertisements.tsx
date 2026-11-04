import { useState } from 'react';

interface Ad { id: number; title: string; category: string; description: string; contact: string; city: string; date: string; featured: boolean; image: string; }
interface AdvertisementsProps { ads: Ad[]; }

export default function Advertisements({ ads }: AdvertisementsProps) {
  const [filter, setFilter] = useState('الكل');
  const [searchTerm, setSearchTerm] = useState('');
  const categories = ['الكل', 'توزيع', 'تجارة', 'محلات'];
  const filteredAds = ads.filter(ad => {
    const matchesCategory = filter === 'الكل' || ad.category === filter;
    const matchesSearch = ad.title.includes(searchTerm) || ad.description.includes(searchTerm) || ad.city.includes(searchTerm);
    return matchesCategory && matchesSearch;
  });
  return (
    <section id="ads" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-2 bg-green-50 text-green-600 rounded-full text-sm font-medium mb-4">أحدث الإعلانات</span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">تصفح الإعلانات المتاحة</h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">اكتشف أحدث العروض والإعلانات من الموزعين والتجار</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 mb-10">
          <div className="flex-1 relative">
            <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="ابحث عن إعلان..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pr-12 pl-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setFilter(cat)} className={`px-5 py-3 rounded-xl font-medium transition-all duration-300 ${filter === cat ? 'bg-gradient-to-l from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{cat}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAds.map((ad) => (
            <div key={ad.id} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-blue-200 transition-all duration-300 hover:scale-105">
              <div className={`p-6 ${ad.featured ? 'bg-gradient-to-l from-yellow-50 to-orange-50' : 'bg-gray-50'}`}>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-4xl">{ad.image}</span>
                  {ad.featured && <span className="bg-gradient-to-l from-yellow-400 to-orange-400 text-gray-900 px-3 py-1 rounded-full text-xs font-bold">⭐ مميز</span>}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">{ad.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed line-clamp-2">{ad.description}</p>
              </div>
              <div className="p-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-xs font-medium">{ad.category}</span>
                    <span className="text-gray-400 text-xs flex items-center gap-1">📍 {ad.city}</span>
                  </div>
                  <span className="text-gray-400 text-xs">{ad.date}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-1">📞 {ad.contact}</span>
                  <button className="text-blue-600 text-sm font-medium hover:text-blue-800 transition-colors">عرض التفاصيل ←</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filteredAds.length === 0 && <div className="text-center py-16"><span className="text-6xl mb-4 block">🔍</span><h3 className="text-xl font-bold text-gray-900 mb-2">لا توجد نتائج</h3><p className="text-gray-500">جرب تغيير معايير البحث أو الفلتر</p></div>}
      </div>
    </section>
  );
}