import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Crown, Layers, Megaphone, MessageSquare, Sparkles, Star } from 'lucide-react';
import Hero from '../components/Hero';
import Stats from '../components/Stats';
import Testimonials from '../components/Testimonials';
import { usePublicContext } from '../components/PublicLayout';
import { INITIAL_TESTIMONIALS } from '../data/seedData';
import { sanitizeHttpUrl } from '../lib/supabase';
import { fetchTestimonials } from '../services/dataService';
import { Testimonial } from '../types';

export default function HomePage() {
  const { settings, ads, loadingAds, onAddAd, onViewAd } = usePublicContext();
  const [testimonials, setTestimonials] = useState<Testimonial[]>(INITIAL_TESTIMONIALS);

  useEffect(() => {
    void fetchTestimonials(false)
      .then((items) => setTestimonials(items))
      .catch(() => undefined);
  }, []);

  const topAds = ads.slice(0, 3);

  const sectionCards = [
    {
      to: '/ads',
      icon: Megaphone,
      title: 'دليل الإعلانات المتكامل',
      desc: 'تصفح عروض الموزعين والتجار وابحث حسب التصنيف والمحافظة.',
      badge: `${ads.length} إعلان`,
    },
    {
      to: '/packages',
      icon: Sparkles,
      title: 'الباقات والترقية',
      desc: 'ابدأ مجاناً أو فعّل الباقة الاحترافية والمؤسسية لظهور في الصدارة.',
      badge: 'تبدأ من 0 ج.م',
    },
    {
      to: '/subscriptions',
      icon: Layers,
      title: 'الاشتراكات والدفعات',
      desc: 'تابع عدّاد أيام اشتراكك، فواتير الجنيه المصري، وتعديل إعلانك.',
      badge: 'متابعة فورية',
    },
    {
      to: '/contact',
      icon: MessageSquare,
      title: 'تواصل مع الإدارة',
      desc: 'افتح تذكرة دعم أو تابع الردود المباشرة من إدارة المنصة.',
      badge: 'رد سريع',
    },
  ];

  return (
    <>
      <Hero onAddAd={onAddAd} />
      <Stats settings={settings} />

      {/* Quick Sections Navigation Grid */}
      <section className="py-16 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 max-w-2xl mx-auto">
            <p className="text-blue-700 text-sm font-bold mb-2">أقسام المنصة المستقلة</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">
              انتقل مباشرة إلى القسم الذي تحتاجه
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {sectionCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.to}
                  to={card.to}
                  className="group p-6 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-200/70 text-slate-700 tabular-nums">
                        {card.badge}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 group-hover:text-blue-700 transition-colors mb-1.5">
                      {card.title}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{card.desc}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">
                    فتح الصفحة
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Lightweight Featured Ads Preview */}
      <section className="py-16 bg-slate-50/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-emerald-700 text-sm font-bold mb-1">مختارات المنصة</p>
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">
                أبرز الإعلانات المميزة حالياً
              </h2>
            </div>
            <Link
              to="/ads"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-colors self-start sm:self-auto"
            >
              تصفح جميع الإعلانات
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>

          {loadingAds ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-56 rounded-2xl border border-slate-200 bg-white animate-pulse p-6"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {topAds.map((ad) => {
                const safeThumb = sanitizeHttpUrl(ad.image_url);
                const isEnterprise = ad.package_name === 'المؤسسي' || ad.priority_rank === 2;
                return (
                  <article
                    key={ad.id}
                    className="rounded-2xl border border-slate-200 bg-white hover:border-blue-300 p-6 flex flex-col justify-between gap-4 transition-all"
                  >
                    <div>
                      {safeThumb && (
                        <div className="mb-4 h-36 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                          <img
                            src={safeThumb}
                            alt={ad.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-2xl" aria-hidden="true">
                          {ad.image}
                        </span>
                        {isEnterprise ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                            <Crown className="w-3 h-3" />
                            مؤسسي
                          </span>
                        ) : ad.featured ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                            مميز
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs font-bold text-blue-700 mb-1">
                        {ad.category} · {ad.city}
                      </p>
                      <h3 className="text-base font-extrabold text-slate-900 mb-1.5 line-clamp-1">
                        {ad.title}
                      </h3>
                      <p className="text-xs text-slate-600 line-clamp-2">{ad.description}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700 tabular-nums">
                        {ad.contact}
                      </span>
                      <button
                        type="button"
                        onClick={() => onViewAd(ad)}
                        className="text-xs font-bold text-blue-700 hover:text-blue-900"
                      >
                        التفاصيل ←
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Testimonials testimonials={testimonials} />
    </>
  );
}
