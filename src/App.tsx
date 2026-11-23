import { Component, ComponentType, ReactNode, Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PublicLayout from './components/PublicLayout';
import HomePage from './pages/HomePage';
import { logSiteVisit } from './services/dataService';

const CHUNK_RELOAD_KEY = 'elanati_chunk_reload_at';

function tryRecoverChunkReload(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
    if (Date.now() - last > 15000) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
      window.location.reload();
      return true;
    }
  } catch {
    // ignore storage errors
  }
  return false;
}

function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (firstErr) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      try {
        return await importer();
      } catch (secondErr) {
        tryRecoverChunkReload();
        throw secondErr || firstErr;
      }
    }
  });
}

const loadFeaturesPage = () => import('./pages/FeaturesPage');
const loadPackagesPage = () => import('./pages/PackagesPage');
const loadSubscriptionsPage = () => import('./pages/SubscriptionsPage');
const loadAdsPage = () => import('./pages/AdsPage');
const loadContactPage = () => import('./pages/ContactPage');

const loadAdminLayout = () => import('./pages/admin/AdminLayout');
const loadAdminOverviewPage = () => import('./pages/admin/AdminOverviewPage');
const loadAdminAdsPage = () => import('./pages/admin/AdminAdsPage');
const loadAdminInboxPage = () => import('./pages/admin/AdminInboxPage');
const loadAdminPackagesPage = () => import('./pages/admin/AdminPackagesPage');
const loadAdminAutomationPage = () => import('./pages/admin/AdminAutomationPage');
const loadAdminSecurityPage = () => import('./pages/admin/AdminSecurityPage');
const loadAdminSettingsPage = () => import('./pages/admin/AdminSettingsPage');

const FeaturesPage = lazyWithRetry(loadFeaturesPage);
const PackagesPage = lazyWithRetry(loadPackagesPage);
const SubscriptionsPage = lazyWithRetry(loadSubscriptionsPage);
const AdsPage = lazyWithRetry(loadAdsPage);
const ContactPage = lazyWithRetry(loadContactPage);

const AdminLayout = lazyWithRetry(loadAdminLayout);
const AdminOverviewPage = lazyWithRetry(loadAdminOverviewPage);
const AdminAdsPage = lazyWithRetry(loadAdminAdsPage);
const AdminInboxPage = lazyWithRetry(loadAdminInboxPage);
const AdminPackagesPage = lazyWithRetry(loadAdminPackagesPage);
const AdminAutomationPage = lazyWithRetry(loadAdminAutomationPage);
const AdminSecurityPage = lazyWithRetry(loadAdminSecurityPage);
const AdminSettingsPage = lazyWithRetry(loadAdminSettingsPage);

interface RouteErrorBoundaryState {
  hasError: boolean;
}

class RouteErrorBoundary extends Component<{ children: ReactNode }, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(err: unknown) {
    const msg = String((err as Error)?.message || err || '').toLowerCase();
    if (
      msg.includes('dynamically imported module') ||
      msg.includes('loading chunk') ||
      msg.includes('failed to fetch')
    ) {
      tryRecoverChunkReload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full text-center space-y-4 shadow-sm">
            <h2 className="text-lg font-extrabold text-slate-900">
              حدث تأخر مؤقت في تحميل الصفحة
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              قد يكون الاتصال انقطع مؤقتاً أو تم نشر تحديث جديد للمنصة. اضغط الزر بالأسفل لإعادة التحميل فوراً.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-colors"
            >
              إعادة تحميل الصفحة الآن
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

function RoutePreloader() {
  const { pathname } = useLocation();
  useEffect(() => {
    const preload = () => {
      const loaders = pathname.startsWith('/admin')
        ? [
            loadAdminOverviewPage,
            loadAdminAdsPage,
            loadAdminInboxPage,
            loadAdminPackagesPage,
            loadAdminAutomationPage,
            loadAdminSecurityPage,
            loadAdminSettingsPage,
          ]
        : [
            loadAdsPage,
            loadPackagesPage,
            loadSubscriptionsPage,
            loadFeaturesPage,
            loadContactPage,
          ];
      loaders.forEach((loader) => {
        void loader().catch(() => undefined);
      });
    };

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === 'function') {
      const idleId = win.requestIdleCallback(preload, { timeout: 2000 });
      return () => win.cancelIdleCallback?.(idleId);
    }
    const timer = window.setTimeout(preload, 1200);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}

function AppLoader() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-bold text-slate-600">جاري التحميل...</p>
      </div>
    </div>
  );
}

export default function App() {
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  useEffect(() => {
    void logSiteVisit(window.location.pathname || '/');
  }, []);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <RoutePreloader />
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <RouteErrorBoundary>
        <Suspense fallback={<AppLoader />}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/packages" element={<PackagesPage />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
              <Route path="/ads" element={<AdsPage />} />
              <Route path="/contact" element={<ContactPage />} />
            </Route>

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/overview" replace />} />
              <Route path="overview" element={<AdminOverviewPage />} />
              <Route path="ads" element={<AdminAdsPage />} />
              <Route path="inbox" element={<AdminInboxPage />} />
              <Route path="packages" element={<AdminPackagesPage />} />
              <Route path="automation" element={<AdminAutomationPage />} />
              <Route path="security" element={<AdminSecurityPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}
