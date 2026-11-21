import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  ExternalLink,
  Inbox,
  Layers,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  RefreshCw,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import AdminAdsManager from '../components/admin/AdminAdsManager';
import AdminAuth from '../components/admin/AdminAuth';
import AdminAutomation from '../components/admin/AdminAutomation';
import AdminContentSettings from '../components/admin/AdminContentSettings';
import AdminInbox from '../components/admin/AdminInbox';
import AdminOverview from '../components/admin/AdminOverview';
import AdminPackagesManager from '../components/admin/AdminPackagesManager';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_SITE_SETTINGS,
  INITIAL_PACKAGES,
} from '../data/seedData';
import { supabase } from '../lib/supabase';
import {
  archiveExpiredAdsAdmin,
  fetchAllAdsAdmin,
  fetchAllTicketsAdmin,
  fetchCategories,
  fetchCategoryItemsAdmin,
  fetchPackageRequestsAdmin,
  fetchPackages,
  fetchSiteSettings,
  fetchTestimonials,
  getAdminSession,
  signOutAdmin,
  updateAdAdmin,
} from '../services/dataService';
import {
  Ad,
  AdminSession,
  CategoryItem,
  ContactMessage,
  PackagePlan,
  PackageRequest,
  SiteSettings,
  Testimonial,
} from '../types';

type AdminTab = 'overview' | 'ads' | 'inbox' | 'packages' | 'automation' | 'settings';

const TAB_TITLES: Record<AdminTab, string> = {
  overview: 'نظرة عامة',
  ads: 'إدارة الإعلانات',
  inbox: 'مركز التواصل والرسائل',
  packages: 'متابعة الاشتراكات والدفعات',
  automation: 'الأتمتة والواتساب',
  settings: 'المحتوى والإعدادات',
};

export default function AdminPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [ads, setAds] = useState<Ad[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [categoryItems, setCategoryItems] = useState<CategoryItem[]>([]);
  const [tickets, setTickets] = useState<ContactMessage[]>([]);
  const [packageRequests, setPackageRequests] = useState<PackageRequest[]>([]);
  const [packages, setPackages] = useState<PackagePlan[]>(INITIAL_PACKAGES);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [selectedTicketCode, setSelectedTicketCode] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [loadError, setLoadError] = useState('');

  const refreshAll = useCallback(async () => {
    setLoadingData(true);
    setLoadError('');
    try {
      await archiveExpiredAdsAdmin().catch(() => 0);
      const [
        loadedAds,
        loadedCategories,
        loadedCategoryItems,
        loadedTickets,
        loadedRequests,
        loadedPackages,
        loadedTestimonials,
        loadedSettings,
      ] = await Promise.all([
        fetchAllAdsAdmin(),
        fetchCategories(),
        fetchCategoryItemsAdmin(),
        fetchAllTicketsAdmin(),
        fetchPackageRequestsAdmin(),
        fetchPackages(),
        fetchTestimonials(true),
        fetchSiteSettings(),
      ]);
      setAds(loadedAds);
      setCategories(loadedCategories);
      setCategoryItems(loadedCategoryItems);
      setTickets(loadedTickets);
      setPackageRequests(loadedRequests);
      setPackages(loadedPackages);
      setTestimonials(loadedTestimonials);
      setSettings(loadedSettings);
    } catch (err: any) {
      setLoadError(err?.message || 'تعذر تحميل بيانات الإدارة');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      try {
        const s = await getAdminSession();
        if (mounted) setSession(s);
      } finally {
        if (mounted) setCheckingAuth(false);
      }
    };
    void initAuth();

    if (supabase) {
      const { data: sub } = supabase.auth.onAuthStateChange(() => {
        void getAdminSession().then((s) => {
          if (mounted) setSession(s);
        });
      });
      return () => {
        mounted = false;
        sub.subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    void refreshAll();

    const client = supabase;
    if (client) {
      const channel = client
        .channel('elanati-admin-live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'elanati_ads' },
          () => void refreshAll()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'elanati_contact_messages' },
          () => void refreshAll()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'elanati_package_requests' },
          () => void refreshAll()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'elanati_categories' },
          () => void refreshAll()
        )
        .subscribe();

      return () => {
        void client.removeChannel(channel);
      };
    }
  }, [session, refreshAll]);

  const handleApproveAd = async (id: string) => {
    await updateAdAdmin(id, { status: 'approved' });
    await refreshAll();
  };

  const handleRejectAd = async (id: string) => {
    await updateAdAdmin(id, { status: 'rejected' });
    await refreshAll();
  };

  const handleOpenTicket = (ticketCode: string) => {
    setSelectedTicketCode(ticketCode);
    setActiveTab('inbox');
  };

  const handleSignOut = async () => {
    await signOutAdmin();
    setSession(null);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-600">جاري التحقق من جلسة المدير...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AdminAuth onSuccess={(newSession) => setSession(newSession)} />;
  }

  const pendingAdsCount = ads.filter((a) => a.status === 'pending').length;
  const openTicketsCount = tickets.filter(
    (t) => t.status === 'new' || t.status === 'in_progress'
  ).length;
  const pendingPackagesCount = packageRequests.filter((r) => r.status === 'pending').length;

  const navItems: {
    id: AdminTab;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
  }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
    { id: 'ads', label: 'إدارة الإعلانات', icon: Megaphone, badge: pendingAdsCount },
    { id: 'inbox', label: 'تواصل العملاء', icon: Inbox, badge: openTicketsCount },
    { id: 'packages', label: 'متابعة الاشتراكات والدفعات', icon: Layers, badge: pendingPackagesCount },
    { id: 'automation', label: 'الأتمتة والواتساب', icon: Bot },
    { id: 'settings', label: 'المحتوى والإعدادات', icon: Settings },
  ];

  const selectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-slate-900 text-white sticky top-0 h-screen">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-sm truncate">{settings.site_name}</p>
            <p className="text-[11px] text-slate-400">لوحة تحكم المدير</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl text-sm font-bold transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-amber-400 text-slate-950'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="text-xs">
            <p className="font-bold text-white truncate">{session.fullName}</p>
            <p className="text-slate-400 truncate mt-0.5" dir="ltr">
              {session.email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              عرض الموقع
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              title="تسجيل الخروج"
              aria-label="تسجيل الخروج"
              className="p-2 rounded-xl bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-slate-900 text-white flex flex-col h-full z-10">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <span className="font-extrabold text-sm">لوحة تحكم المدير</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="إغلاق القائمة"
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectTab(item.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl text-sm font-bold ${
                      active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] bg-amber-400 text-slate-950 tabular-nums">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-800 flex items-center gap-2">
              <Link
                to="/"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 text-xs font-bold text-white"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                عرض الموقع
              </Link>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="px-3 py-2.5 rounded-xl bg-red-600/20 text-red-300 text-xs font-bold"
              >
                خروج
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="فتح القائمة"
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">{TAB_TITLES[activeTab]}</h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                إدارة منصة {settings.site_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={loadingData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              تحديث
            </button>
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              الواجهة العامة
            </Link>
          </div>
        </header>

        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-5">
          {loadError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              {loadError}
            </div>
          )}

          {activeTab === 'overview' && (
            <AdminOverview
              ads={ads}
              tickets={tickets}
              packageRequests={packageRequests}
              onApproveAd={handleApproveAd}
              onRejectAd={handleRejectAd}
              onNavigateTab={(t) => setActiveTab(t)}
              onOpenTicket={handleOpenTicket}
            />
          )}

          {activeTab === 'ads' && (
            <AdminAdsManager ads={ads} categories={categories} onRefresh={refreshAll} />
          )}

          {activeTab === 'inbox' && (
            <AdminInbox
              tickets={tickets}
              initialSelectedCode={selectedTicketCode}
              adminName={session.fullName}
              onRefresh={refreshAll}
            />
          )}

          {activeTab === 'packages' && (
            <AdminPackagesManager
              requests={packageRequests}
              packages={packages}
              onRefresh={refreshAll}
            />
          )}

          {activeTab === 'automation' && <AdminAutomation onRefresh={refreshAll} />}

          {activeTab === 'settings' && (
            <AdminContentSettings
              settings={settings}
              testimonials={testimonials}
              categoryItems={categoryItems}
              onRefresh={refreshAll}
            />
          )}
        </main>
      </div>
    </div>
  );
}
