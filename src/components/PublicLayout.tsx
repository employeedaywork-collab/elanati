import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import Footer from './Footer';
import Navbar from './Navbar';
import SupportWidget from './SupportWidget';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_SITE_SETTINGS,
  INITIAL_ADS,
  INITIAL_PACKAGES,
} from '../data/seedData';
import {
  createAd,
  fetchCategories,
  fetchPackages,
  fetchPublicAds,
  fetchPublicAutomationTemplates,
  fetchSiteSettings,
  fetchVerifiedClientPortal,
  getAdminSession,
  getStoredPortalSession,
  incrementAdViews,
  renderWhatsAppTemplate,
} from '../services/dataService';
import { Ad, AdCategory, AdSpecs, ItemCondition, PackagePlan, SiteSettings } from '../types';

const AddAdForm = lazy(() => import('./AddAdForm'));
const AdDetailsModal = lazy(() => import('./AdDetailsModal'));
const PackageRequestModal = lazy(() => import('./PackageRequestModal'));
const ClientSubscriptionModal = lazy(() => import('./ClientSubscriptionModal'));

export interface PublicOutletContext {
  settings: SiteSettings;
  ads: Ad[];
  categories: string[];
  packages: PackagePlan[];
  loadingAds: boolean;
  isAdmin: boolean;
  onAddAd: () => void;
  onViewAd: (ad: Ad) => void;
  onSelectPackage: (pkg: PackagePlan, cycle: 'monthly' | 'annual') => void;
  onOpenPortal: (initialQuery?: string) => void;
  onRequestAdminEdit: (ad: Ad) => void;
  onRequestSupportTicket: (subject: string) => void;
  onTicketCreated: (ticketCode: string) => void;
  onRefreshData: () => Promise<void>;
}

export function usePublicContext(): PublicOutletContext {
  return useOutletContext<PublicOutletContext>();
}

function PageLoader() {
  return (
    <div className="min-h-[55vh] flex items-center justify-center p-8">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold text-slate-500">جاري تحميل الصفحة...</p>
      </div>
    </div>
  );
}

export default function PublicLayout() {
  const navigate = useNavigate();

  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [ads, setAds] = useState<Ad[]>(INITIAL_ADS);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [packages, setPackages] = useState<PackagePlan[]>(INITIAL_PACKAGES);
  const [loadingAds, setLoadingAds] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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
      const [loadedSettings, loadedAds, loadedCategories, loadedPackages, adminSess] =
        await Promise.all([
          fetchSiteSettings(),
          fetchPublicAds(),
          fetchCategories(),
          fetchPackages(),
          getAdminSession().catch(() => null),
        ]);
      setSettings(loadedSettings);
      setAds(loadedAds);
      setCategories(loadedCategories);
      setPackages(loadedPackages);
      setIsAdmin(Boolean(adminSess));
    } finally {
      setLoadingAds(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Automatic zero-cost in-platform reminder check only when client already verified OTP session
  useEffect(() => {
    const verifiedSession = getStoredPortalSession();
    if (!verifiedSession) return;
    try {
      if (sessionStorage.getItem('elanati_reminder_dismissed') === '1') return;
    } catch {
      return;
    }

    const savedQuery = verifiedSession.query || '';
    void (async () => {
      try {
        const [verified, tpl] = await Promise.all([
          fetchVerifiedClientPortal(),
          fetchPublicAutomationTemplates(),
        ]);
        const portal = verified.portal;
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

  const handleOpenAddAd = useCallback(() => {
    setShowAddAd(true);
  }, []);

  const handleOpenPortal = useCallback((initialQ = '') => {
    setPortalQuery(initialQ);
    setPortalOpen(true);
  }, []);

  const goToPackages = useCallback(() => {
    navigate('/packages');
  }, [navigate]);

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
    price?: number | null;
    price_negotiable?: boolean;
    item_condition?: ItemCondition;
    specs?: AdSpecs | null;
    latitude?: number | null;
    longitude?: number | null;
    location_address?: string | null;
    subscription_code?: string;
  }): Promise<{ requiresReview: boolean; ownerPin: string }> => {
    const result = await createAd({
      ...input,
      requireApproval: settings.require_ad_approval,
    });
    const refreshedCats = await fetchCategories().catch(() => null);
    if (refreshedCats) {
      setCategories(refreshedCats);
    }
    if (!result.requiresReview) {
      const refreshed = await fetchPublicAds();
      setAds(refreshed);
    }
    return {
      requiresReview: result.requiresReview,
      ownerPin: result.ad.owner_pin || '',
    };
  };

  const handleViewAd = useCallback((ad: Ad) => {
    const updatedAd: Ad = { ...ad, views_count: (ad.views_count || 0) + 1 };
    setViewingAd(updatedAd);
    setAds((prev) => prev.map((item) => (item.id === ad.id ? updatedAd : item)));
    void incrementAdViews(ad.id);
  }, []);

  const handleSelectPackage = useCallback((pkg: PackagePlan, cycle: 'monthly' | 'annual') => {
    if (pkg.monthly_price === 0 && pkg.annual_price === 0) {
      setShowAddAd(true);
      return;
    }
    setSelectedPackage({ pkg, cycle });
  }, []);

  const handleInquireAdmin = useCallback((ad: Ad) => {
    setViewingAd(null);
    setSupportPrefillSubject(`استفسار حول إعلان: ${ad.title}`);
    setSupportPrefillAdId(ad.id);
    setSupportInitialTab('new');
    setSupportOpen(true);
  }, []);

  const handleRequestAdminEdit = useCallback((ad: Ad) => {
    setSupportPrefillSubject(`طلب تعديل إعلان عبر الإدارة: ${ad.title}`);
    setSupportPrefillAdId(ad.id);
    setSupportInitialTab('new');
    setSupportOpen(true);
  }, []);

  const handleRequestSupportTicket = useCallback((subject: string) => {
    setSupportPrefillSubject(subject);
    setSupportPrefillAdId(null);
    setSupportInitialTab('new');
    setSupportOpen(true);
  }, []);

  const handleTicketCreated = useCallback((ticketCode: string) => {
    setActiveTicketCode(ticketCode);
    setSupportInitialTab('track');
    setSupportOpen(true);
  }, []);

  const outletContext: PublicOutletContext = {
    settings,
    ads,
    categories,
    packages,
    loadingAds,
    isAdmin,
    onAddAd: handleOpenAddAd,
    onViewAd: handleViewAd,
    onSelectPackage: handleSelectPackage,
    onOpenPortal: handleOpenPortal,
    onRequestAdminEdit: handleRequestAdminEdit,
    onRequestSupportTicket: handleRequestSupportTicket,
    onTicketCreated: handleTicketCreated,
    onRefreshData: loadData,
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <Navbar
        siteName={settings.site_name}
        isAdmin={isAdmin}
        onAddAd={handleOpenAddAd}
        onOpenPortal={() => handleOpenPortal()}
      />

      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Outlet context={outletContext} />
        </Suspense>
      </main>

      <Footer
        settings={settings}
        onAddAd={handleOpenAddAd}
        onOpenPortal={() => handleOpenPortal()}
      />

      <Suspense fallback={null}>
        {showAddAd && (
          <AddAdForm
            settings={settings}
            categories={categories}
            onSubmit={handleCreateAd}
            onClose={() => setShowAddAd(false)}
            onUpgrade={goToPackages}
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
            categories={categories}
            initialQuery={portalQuery}
            onClose={() => setPortalOpen(false)}
            onAddAd={handleOpenAddAd}
            onUpgrade={goToPackages}
            onRequestAdminEdit={handleRequestAdminEdit}
            onRequestSupportTicket={handleRequestSupportTicket}
            onAdUpdated={loadData}
          />
        )}
      </Suspense>

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
                goToPackages();
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
