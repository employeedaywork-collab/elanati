import { useCallback, useEffect, useState } from 'react';
import AddAdForm from '../components/AddAdForm';
import AdDetailsModal from '../components/AdDetailsModal';
import Advertisements from '../components/Advertisements';
import ClientSubscriptionModal from '../components/ClientSubscriptionModal';
import Contact from '../components/Contact';
import Features from '../components/Features';
import Footer from '../components/Footer';
import Hero from '../components/Hero';
import Navbar from '../components/Navbar';
import PackageRequestModal from '../components/PackageRequestModal';
import Packages from '../components/Packages';
import Stats from '../components/Stats';
import SupportWidget from '../components/SupportWidget';
import Testimonials from '../components/Testimonials';
import {
  DEFAULT_SITE_SETTINGS,
  INITIAL_ADS,
  INITIAL_PACKAGES,
  INITIAL_TESTIMONIALS,
} from '../data/seedData';
import { Sparkles, X } from 'lucide-react';
import {
  createAd,
  fetchClientPortal,
  fetchPackages,
  fetchPublicAds,
  fetchPublicAutomationTemplates,
  fetchSiteSettings,
  fetchTestimonials,
  incrementAdViews,
  renderWhatsAppTemplate,
} from '../services/dataService';
import { Ad, AdCategory, PackagePlan, SiteSettings, Testimonial } from '../types';

export default function HomePage() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [ads, setAds] = useState<Ad[]>(INITIAL_ADS);
  const [packages, setPackages] = useState<PackagePlan[]>(INITIAL_PACKAGES);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(INITIAL_TESTIMONIALS);
  const [loadingAds, setLoadingAds] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<AdCategory | 'الكل'>('الكل');
  const [showAddAd, setShowAddAd] = useState(false);
  const [viewingAd, setViewingAd] = useState<Ad | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<{
    pkg: PackagePlan;
    cycle: 'monthly' | 'annual';
  } | null>(null);

  const [portalOpen, setPortalOpen] = useState(false);
  const [portalQuery, setPortalQuery] = useState('');

  const [supportOpen, setSupportOpen] = useState(false);
  const [supportInitialTab, setSupportInitialTab] = useState<'new' | 'track' | 'direct'>('new');
  const [supportPrefillSubject, setSupportPrefillSubject] = useState('');
  const [supportPrefillAdId, setSupportPrefillAdId] = useState<string | null>(null);
  const [activeTicketCode, setActiveTicketCode] = useState<string | null>(null);
  const [clientReminder, setClientReminder] = useState<{
    query: string;
    message: string;
    isPaid: boolean;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [loadedSettings, loadedAds, loadedPackages, loadedTestimonials] = await Promise.all([
        fetchSiteSettings(),
        fetchPublicAds(),
        fetchPackages(),
        fetchTestimonials(false),
      ]);
      setSettings(loadedSettings);
      setAds(loadedAds);
      setPackages(loadedPackages);
      setTestimonials(loadedTestimonials);
    } finally {
      setLoadingAds(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Automatic zero-cost in-platform reminder check for returning advertisers
  useEffect(() => {
    let savedQuery = '';
    try {
      savedQuery =
        localStorage.getItem('elanati_last_sub_code') ||
        localStorage.getItem('elanati_last_client_phone') ||
        '';
      if (sessionStorage.getItem('elanati_reminder_dismissed') === '1') return;
    } catch {
      return;
    }
    if (!savedQuery.trim()) return;

    void (async () => {
      try {
        const [portal, tpl] = await Promise.all([
          fetchClientPortal(savedQuery),
          fetchPublicAutomationTemplates(),
        ]);
        const now = Date.now();
        const sub = portal.subscription;
        if (sub && sub.status === 'activated' && sub.expires_at) {
          const remMs = new Date(sub.expires_at).getTime() - now;
          if (remMs > 0 && remMs <= tpl.paid_reminder_days_before * 24 * 60 * 60 * 1000) {
            const remDays = Math.max(1, Math.ceil(remMs / (1000 * 60 * 60 * 24)));
            setClientReminder({
              query: savedQuery,
              isPaid: true,
              message: renderWhatsAppTemplate(tpl.paid_expiry_template, {
                الاسم: sub.client_name || 'عميلنا العزيز',
                الباقة: sub.package_name,
                كود_الاشتراك: sub.subscription_code || '-',
                الأيام_المتبقية: remDays,
                تاريخ_الانتهاء: sub.expires_at.split('T')[0],
              }),
            });
            return;
          }
        }
        const freeAd = !sub ? portal.ads[0] : null;
        if (freeAd && freeAd.status === 'approved' && freeAd.expires_at) {
          const remMs = new Date(freeAd.expires_at).getTime() - now;
          if (remMs > 0 && remMs <= tpl.free_reminder_hours_before * 60 * 60 * 1000) {
            setClientReminder({
              query: savedQuery,
              isPaid: false,
              message: renderWhatsAppTemplate(tpl.free_expiry_template, {
                الاسم: freeAd.client_name || 'عميلنا العزيز',
                عنوان_الإعلان: freeAd.title,
                المشاهدات: freeAd.views_count || 0,
                تاريخ_الانتهاء: freeAd.expires_at.split('T')[0],
              }),
            });
          }
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const handleOpenAddAd = () => {
    setShowAddAd(true);
  };

  const handleOpenPortal = (initialQ = '') => {
    setPortalQuery(initialQ);
    setPortalOpen(true);
  };

  const scrollToPackages = () => {
    const el = document.getElementById('packages');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCreateAd = async (input: {
    client_name?: string;
    title: string;
    category: AdCategory;
    description: string;
    contact: string;
    city: string;
    image: string;
    image_url?: string;
    extra_images?: string[];
    banner_url?: string;
    subscription_code?: string;
  }): Promise<{ requiresReview: boolean }> => {
    const result = await createAd({
      ...input,
      requireApproval: settings.require_ad_approval,
    });
    if (!result.requiresReview) {
      const refreshed = await fetchPublicAds();
      setAds(refreshed);
    }
    return { requiresReview: result.requiresReview };
  };

  const handleViewAd = (ad: Ad) => {
    const updatedAd: Ad = { ...ad, views_count: (ad.views_count || 0) + 1 };
    setViewingAd(updatedAd);
    setAds((prev) => prev.map((item) => (item.id === ad.id ? updatedAd : item)));
    void incrementAdViews(ad.id);
  };

  const handleSelectPackage = (pkg: PackagePlan, cycle: 'monthly' | 'annual') => {
    if (pkg.monthly_price === 0 && pkg.annual_price === 0) {
      setShowAddAd(true);
      return;
    }
    setSelectedPackage({ pkg, cycle });
  };

  const handleInquireAdmin = (ad: Ad) => {
    setViewingAd(null);
    setSupportPrefillSubject(`استفسار حول إعلان: ${ad.title}`);
    setSupportPrefillAdId(ad.id);
    setSupportInitialTab('new');
    setSupportOpen(true);
  };

  const handleTicketCreated = (ticketCode: string) => {
    setActiveTicketCode(ticketCode);
    setSupportInitialTab('track');
    setSupportOpen(true);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Navbar
        siteName={settings.site_name}
        onAddAd={handleOpenAddAd}
        onOpenPortal={() => handleOpenPortal()}
      />

      <main>
        <Hero onAddAd={handleOpenAddAd} onSelectCategory={setSelectedCategory} />
        <Stats settings={settings} />
        <Features />
        <Packages packages={packages} onSelectPackage={handleSelectPackage} />
        <Advertisements
          ads={ads}
          loading={loadingAds}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onViewAd={handleViewAd}
          onAddAd={handleOpenAddAd}
        />
        <Testimonials testimonials={testimonials} />
        <Contact settings={settings} onTicketCreated={handleTicketCreated} />
      </main>

      <Footer
        settings={settings}
        onAddAd={handleOpenAddAd}
        onSelectCategory={setSelectedCategory}
        onOpenPortal={() => handleOpenPortal()}
      />

      {showAddAd && (
        <AddAdForm
          settings={settings}
          onSubmit={handleCreateAd}
          onClose={() => setShowAddAd(false)}
          onUpgrade={scrollToPackages}
          onOpenPortal={(q) => handleOpenPortal(q)}
        />
      )}

      {viewingAd && (
        <AdDetailsModal
          ad={viewingAd}
          onClose={() => setViewingAd(null)}
          onInquireAdmin={handleInquireAdmin}
        />
      )}

      {selectedPackage && (
        <PackageRequestModal
          pkg={selectedPackage.pkg}
          cycle={selectedPackage.cycle}
          settings={settings}
          onClose={() => setSelectedPackage(null)}
          onOpenPortal={(subCode) => handleOpenPortal(subCode)}
        />
      )}

      {portalOpen && (
        <ClientSubscriptionModal
          settings={settings}
          initialQuery={portalQuery}
          onClose={() => setPortalOpen(false)}
          onAddAd={handleOpenAddAd}
          onUpgrade={scrollToPackages}
        />
      )}

      {clientReminder && (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm bg-slate-900 text-white rounded-3xl p-4 shadow-2xl border border-amber-400/40 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>تنبيه تلقائي لاشتراكك على إعلاناتي</span>
            </div>
            <button
              type="button"
              aria-label="إغلاق التنبيه"
              onClick={() => {
                setClientReminder(null);
                try {
                  sessionStorage.setItem('elanati_reminder_dismissed', '1');
                } catch {
                  // ignore
                }
              }}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line line-clamp-5">
            {clientReminder.message}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setClientReminder(null);
                scrollToPackages();
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold transition-colors"
            >
              {clientReminder.isPaid ? 'تجديد الاشتراك' : 'ترقية بـ 249 ج.م'}
            </button>
            <button
              type="button"
              onClick={() => {
                const q = clientReminder.query;
                setClientReminder(null);
                handleOpenPortal(q);
              }}
              className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
            >
              العدّاد التنازلي
            </button>
          </div>
        </div>
      )}

      <SupportWidget
        settings={settings}
        isOpen={supportOpen}
        onToggle={setSupportOpen}
        initialTab={supportInitialTab}
        prefillSubject={supportPrefillSubject}
        prefillAdId={supportPrefillAdId}
        activeTicketCode={activeTicketCode}
      />
    </div>
  );
}
