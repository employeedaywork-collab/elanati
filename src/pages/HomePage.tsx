import { useCallback, useEffect, useState } from 'react';
import AddAdForm from '../components/AddAdForm';
import AdDetailsModal from '../components/AdDetailsModal';
import Advertisements from '../components/Advertisements';
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
import {
  createAd,
  fetchPackages,
  fetchPublicAds,
  fetchSiteSettings,
  fetchTestimonials,
  incrementAdViews,
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

  const [supportOpen, setSupportOpen] = useState(false);
  const [supportInitialTab, setSupportInitialTab] = useState<'new' | 'track' | 'direct'>('new');
  const [supportPrefillSubject, setSupportPrefillSubject] = useState('');
  const [supportPrefillAdId, setSupportPrefillAdId] = useState<string | null>(null);
  const [activeTicketCode, setActiveTicketCode] = useState<string | null>(null);

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

  const handleOpenAddAd = () => {
    setShowAddAd(true);
  };

  const handleCreateAd = async (input: {
    title: string;
    category: AdCategory;
    description: string;
    contact: string;
    city: string;
    image: string;
    image_url?: string;
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
      <Navbar siteName={settings.site_name} onAddAd={handleOpenAddAd} />

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
      />

      {showAddAd && (
        <AddAdForm
          requireApproval={settings.require_ad_approval}
          onSubmit={handleCreateAd}
          onClose={() => setShowAddAd(false)}
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
          adminWhatsApp={settings.whatsapp_number}
          onClose={() => setSelectedPackage(null)}
        />
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
