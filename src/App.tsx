import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PublicLayout from './components/PublicLayout';
import HomePage from './pages/HomePage';

const FeaturesPage = lazy(() => import('./pages/FeaturesPage'));
const PackagesPage = lazy(() => import('./pages/PackagesPage'));
const SubscriptionsPage = lazy(() => import('./pages/SubscriptionsPage'));
const AdsPage = lazy(() => import('./pages/AdsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage'));
const AdminAdsPage = lazy(() => import('./pages/admin/AdminAdsPage'));
const AdminInboxPage = lazy(() => import('./pages/admin/AdminInboxPage'));
const AdminPackagesPage = lazy(() => import('./pages/admin/AdminPackagesPage'));
const AdminAutomationPage = lazy(() => import('./pages/admin/AdminAutomationPage'));
const AdminSecurityPage = lazy(() => import('./pages/admin/AdminSecurityPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
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

  return (
    <BrowserRouter>
      <ScrollToTop />
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
    </BrowserRouter>
  );
}
