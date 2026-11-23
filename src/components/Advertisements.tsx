import { useState } from 'react';
import { Clock, Crown, Heart, Image as ImageIcon, MapPin, Search, Star } from 'lucide-react';
import { DEFAULT_CATEGORIES, EGYPT_GOVERNORATES, ITEM_CONDITION_LABELS } from '../data/seedData';
import { sanitizeAdImageUrl, sanitizeHttpUrl } from '../lib/supabase';
import { getFavoriteAdIds, getRemainingDays, toggleFavoriteAdId } from '../services/dataService';
import { Ad, AdCategory, ItemCondition } from '../types';

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
  const [conditionFilter, setConditionFilter] = useState<'all' | ItemCondition>('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteAdIds());

  const categories: (AdCategory | 'الكل')[] = ['الكل', ...propCategories];

  const handleToggleFavorite = (adId: string) => {
    setFavoriteIds(toggleFavoriteAdId(adId));
  };

  const minP = minPrice.trim() !== '' && Number.isFinite(Number(minPrice)) ? Number(minPrice) : null;
  const maxP = maxPrice.trim() !== '' && Number.isFinite(Number(maxPrice)) ? Number(maxPrice) : null;

  const filteredAds = ads.filter((ad) => {
    const matchesCategory = selectedCategory === 'الكل' || ad.category === selectedCategory;
    const matchesCity = selectedCity === 'الكل' || ad.city === selectedCity;
    const matchesCondition =
      conditionFilter === 'all' || (ad.item_condition || 'unspecified') === conditionFilter;
    const matchesFavorites = !favoritesOnly || favoriteIds.includes(ad.id);

    const hasMin = minP !== null;
    const hasMax = maxP !== null;
    const adPrice = typeof ad.price === 'number' ? ad.price : null;
    const matchesMin = !hasMin || (adPrice !== null && adPrice >= minP);
    const matchesMax = !hasMax || (adPrice !== null && adPrice <= maxP);

    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      ad.title.toLowerCase().includes(query) ||
      ad.description.toLowerCase().includes(query) ||
      ad.city.toLowerCase().includes(query) ||
      (ad.location_address || '').toLowerCase().includes(query);

    return (
      matchesCategory &&
      matchesCity &&
      matchesCondition &&
      matchesFavorites &&
      matchesMin &&
      matchesMax &&
      matchesSearch
    );
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

  const resetFilters = () => {
    onCategoryChange('الكل');
    setSelectedCity('الكل');
    setConditionFilter('all');
    setMinPrice('');
    setMaxPrice('');
    setFavoritesOnly(false);
    setSearchTerm('');
  };

  return (
    <section id="ads" className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 max-w-2xl mx-auto">
          <p className="text-emerald-700 text-sm font-bold mb-2">أحدث العروض</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 [text-wrap:balance]">
            تصفح الإعلانات المتاحة
          </h2>
          <p className="text-slate-600 text-base md:text-lg">
            اكتشف أحدث الإعلانات الشخصية والتجارية والسيارات والعقارات في مختلف محافظات مصر
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
                  {(() => {
                    const safeBanner = sanitizeHttpUrl(ad.banner_url);
                    return safeBanner ? (
                      <div className="sm:w-44 h-36 sm:h-auto shrink-0 bg-slate-800">
                        <img
                          src={safeBanner}
                          alt={ad.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : null;
                  })()}
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

        {/* Categories Horizontal Scroll Bar */}
        <div className="mb-4 flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === cat
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search, Location, Price & Condition Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 mb-10 items-center">
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ابحث بالعنوان أو الوصف أو المنطقة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
            />
          </div>

          <select
            aria-label="تصفية حسب المحافظة"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="lg:col-span-2 px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
          >
            <option value="الكل">جميع المحافظات</option>
            {EGYPT_GOVERNORATES.map((gov) => (
              <option key={gov} value={gov}>
                {gov}
              </option>
            ))}
          </select>

          <select
            aria-label="تصفية حسب الحالة"
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value as 'all' | ItemCondition)}
            className="lg:col-span-2 px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
          >
            <option value="all">جميع الحالات</option>
            <option value="new">جديد فقط</option>
            <option value="used">مستعمل فقط</option>
          </select>

          <div className="lg:col-span-2 grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              placeholder="أقل سعر"
              aria-label="أقل سعر"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl bg-white tabular-nums outline-none focus:ring-2 focus:ring-blue-600"
            />
            <input
              type="number"
              min={0}
              placeholder="أعلى سعر"
              aria-label="أعلى سعر"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl bg-white tabular-nums outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <button
            type="button"
            onClick={() => setFavoritesOnly((prev) => !prev)}
            className={`lg:col-span-2 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-extrabold transition-colors ${
              favoritesOnly
                ? 'bg-rose-600 border-rose-600 text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Heart className={`w-4 h-4 ${favoritesOnly ? 'fill-white' : 'text-rose-500'}`} />
            <span>المفضلة ({favoriteIds.length})</span>
          </button>
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
              const isFav = favoriteIds.includes(ad.id);
              const safeThumb = sanitizeAdImageUrl(ad.image_url);
              const conditionLabel =
                ad.item_condition && ad.item_condition !== 'unspecified'
                  ? ITEM_CONDITION_LABELS[ad.item_condition]
                  : null;

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
                    {safeThumb && (
                      <div className="relative mb-4 aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                        <img
                          src={safeThumb}
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
                    )}

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

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(ad.id);
                          }}
                          aria-label={isFav ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}
                          title={isFav ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isFav
                              ? 'bg-rose-50 border-rose-200 text-rose-600'
                              : 'bg-white border-slate-200 text-slate-400 hover:text-rose-500'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500' : ''}`} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500 mb-2 tabular-nums">
                      <span className="text-blue-700 font-bold">{ad.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{ad.city}</span>
                      {conditionLabel && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-700 font-semibold">{conditionLabel}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{formatDate(ad.starts_at || ad.created_at)}</span>
                    </div>

                    <h3 className="text-lg font-extrabold text-slate-900 mb-1.5 group-hover:text-blue-700 transition-colors">
                      {ad.title}
                    </h3>

                    {typeof ad.price === 'number' && (
                      <p className="text-base font-extrabold text-emerald-700 mb-2 tabular-nums">
                        {ad.price.toLocaleString('en-US')} ج.م
                        {ad.price_negotiable && (
                          <span className="text-xs font-bold text-slate-500 mr-1.5">
                            · قابل للتفاوض
                          </span>
                        )}
                      </p>
                    )}

                    <p className="text-slate-600 text-sm leading-relaxed line-clamp-2">
                      {ad.description}
                    </p>

                    {(ad.location_address ||
                      (typeof ad.latitude === 'number' && typeof ad.longitude === 'number')) && (
                      <p className="mt-2.5 text-[11px] font-semibold text-slate-500 flex items-center gap-1 truncate">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">
                          {ad.location_address || 'محدد على الخريطة'}
                        </span>
                      </p>
                    )}
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
              جرب تغيير التصنيف أو المحافظة أو نطاق السعر أو قم بنشر إعلانك الآن
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                onClick={resetFilters}
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
