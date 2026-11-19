import { useState } from 'react';
import { Clock, Crown, Image as ImageIcon, Search, Star } from 'lucide-react';
import { DEFAULT_CATEGORIES, EGYPT_GOVERNORATES } from '../data/seedData';
import { getRemainingDays } from '../services/dataService';
import { Ad, AdCategory } from '../types';

interface AdvertisementsProps {
  ads: Ad[];
  categories?: string[];
  loading?: boolean;
  selectedCategory: AdCategory | 'الكل';
  onCategoryChange: (category: AdCategory | 'الكل') => void;
  onViewAd: (ad: Ad) => void;
  onAddAd: () => void;
}

export default function Advertisements({
  ads,
  categories: propCategories = DEFAULT_CATEGORIES,
  loading = false,
  selectedCategory,
  onCategoryChange,
  onViewAd,
  onAddAd,
}: AdvertisementsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('الكل');

  const categories: (AdCategory | 'الكل')[] = ['الكل', ...propCategories];

  const filteredAds = ads.filter((ad) => {
    const matchesCategory = selectedCategory === 'الكل' || ad.category === selectedCategory;
    const matchesCity = selectedCity === 'الكل' || ad.city === selectedCity;
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      ad.title.toLowerCase().includes(query) ||
      ad.description.toLowerCase().includes(query) ||
      ad.city.toLowerCase().includes(query);
    return matchesCategory && matchesCity && matchesSearch;
  });

  const enterpriseBanners = ads.filter(
    (ad) => ad.status === 'approved' && (ad.priority_rank === 2 || Boolean(ad.banner_url))
  );

  const formatDate = (iso: string) => {
    try {
      return iso.split('T')[0];
    } catch {
      return iso;
    }
  };

  return (
    <section id="ads" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <p className="text-emerald-700 text-sm font-bold mb-2">أحدث العروض</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 [text-wrap:balance]">
            تصفح الإعلانات المتاحة
          </h2>
          <p className="text-slate-600 text-base md:text-lg">
            اكتشف أحدث عروض الموزعين والتجار والمحلات في مختلف محافظات مصر
          </p>
        </div>

        {/* Enterprise VIP Banners Showcase */}
        {!loading && enterpriseBanners.length > 0 && (
          <div className="mb-10 space-y-4">
            <div className="flex items-center gap-2 text-xs font-extrabold text-blue-800">
              <Crown className="w-4 h-4 text-amber-500" />
              <span>بانرات وإعلانات الشركات المميزة (الباقة المؤسسية)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enterpriseBanners.slice(0, 2).map((ad) => (
                <div
                  key={`banner-${ad.id}`}
                  onClick={() => onViewAd(ad)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onViewAd(ad);
                  }}
                  className="cursor-pointer rounded-2xl bg-slate-900 text-white border border-blue-500/40 overflow-hidden shadow-md hover:shadow-lg transition-all flex flex-col sm:flex-row"
                >
                  {ad.banner_url && (
                    <div className="sm:w-44 h-36 sm:h-auto shrink-0 bg-slate-800">
                      <img
                        src={ad.banner_url}
                        alt={ad.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                          <Crown className="w-3.5 h-3.5" />
                          أولوية مؤسسية · {ad.city}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
                          ظهور دائم
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-white mb-1">{ad.title}</h3>
                      <p className="text-xs text-slate-300 line-clamp-2">{ad.description}</p>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
                      <span className="tabular-nums text-slate-300 font-semibold">{ad.contact}</span>
                      <span className="text-amber-400 font-bold">استعراض البانر ←</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 mb-10 items-stretch lg:items-center">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ابحث بالعنوان أو الوصف أو المحافظة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-12 pl-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
            />
          </div>

          <select
            aria-label="تصفية حسب المحافظة"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
          >
            <option value="الكل">جميع المحافظات</option>
            {EGYPT_GOVERNORATES.map((gov) => (
              <option key={gov} value={gov}>
                {gov}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-64 rounded-2xl border border-slate-200 bg-slate-50 animate-pulse p-6"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAds.map((ad) => {
              const remainingDays = getRemainingDays(ad.expires_at);
              const isEnterprise = ad.package_name === 'المؤسسي' || ad.priority_rank === 2;
              const extraCount = ad.extra_images?.length || 0;

              return (
                <article
                  key={ad.id}
                  className={`group flex flex-col justify-between rounded-2xl border overflow-hidden transition-all ${
                    isEnterprise
                      ? 'bg-blue-50/30 border-blue-300 hover:border-blue-400'
                      : ad.featured
                      ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                      : 'bg-white border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="p-6">
                    {ad.image_url ? (
                      <div className="relative mb-4 h-40 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                        <img
                          src={ad.image_url}
                          alt={ad.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        {extraCount > 0 && (
                          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/80 text-white text-[11px] font-bold">
                            <ImageIcon className="w-3 h-3" />+{extraCount} صور
                          </span>
                        )}
                      </div>
                    ) : null}

                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="text-3xl leading-none" aria-hidden="true">
                        {ad.image}
                      </span>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {isEnterprise ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                            <Crown className="w-3 h-3" />
                            مؤسسي
                          </span>
                        ) : ad.featured ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                            إعلان مميز
                          </span>
                        ) : null}

                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 tabular-nums">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {remainingDays === null
                            ? 'ظهور دائم'
                            : `متبقي ${remainingDays} ${remainingDays === 1 ? 'يوم' : 'أيام'}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2 tabular-nums">
                      <span className="text-blue-700 font-bold">{ad.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{ad.city}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDate(ad.starts_at || ad.created_at)}</span>
                    </div>

                    <h3 className="text-lg font-extrabold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">
                      {ad.title}
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed line-clamp-2">
                      {ad.description}
                    </p>
                  </div>

                  <div className="px-6 py-4 border-t border-slate-200/80 bg-white/80 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-700 tabular-nums truncate">
                      {ad.contact}
                    </span>
                    <button
                      type="button"
                      onClick={() => onViewAd(ad)}
                      className="text-blue-700 hover:text-blue-900 text-sm font-bold transition-colors whitespace-nowrap shrink-0"
                    >
                      عرض التفاصيل ←
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && filteredAds.length === 0 && (
          <div className="text-center py-16 border border-dashed border-slate-300 rounded-2xl bg-slate-50">
            <h3 className="text-xl font-bold text-slate-900 mb-2">لا توجد إعلانات مطابقة للبحث</h3>
            <p className="text-slate-600 text-sm mb-6">
              جرب تغيير التصنيف أو المحافظة أو قم بنشر إعلانك الآن
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  onCategoryChange('الكل');
                  setSelectedCity('الكل');
                  setSearchTerm('');
                }}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-white transition-colors"
              >
                إعادة ضبط الفلتر
              </button>
              <button
                type="button"
                onClick={onAddAd}
                className="px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-bold hover:bg-blue-800 transition-colors"
              >
                أضف إعلانك
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
