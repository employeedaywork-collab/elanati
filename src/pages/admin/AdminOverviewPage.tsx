import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminOverview from '../../components/admin/AdminOverview';
import {
  fetchAllAdsAdmin,
  fetchAllTicketsAdmin,
  fetchPackageRequestsAdmin,
  updateAdAdmin,
} from '../../services/dataService';
import { Ad, ContactMessage, PackageRequest } from '../../types';
import { useAdminContext } from './AdminLayout';

export default function AdminOverviewPage() {
  const navigate = useNavigate();
  const { refreshTick, onTriggerRefresh } = useAdminContext();

  const [ads, setAds] = useState<Ad[]>([]);
  const [tickets, setTickets] = useState<ContactMessage[]>([]);
  const [packageRequests, setPackageRequests] = useState<PackageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOverview = useCallback(async () => {
    setError('');
    try {
      const [loadedAds, loadedTickets, loadedRequests] = await Promise.all([
        fetchAllAdsAdmin(),
        fetchAllTicketsAdmin(),
        fetchPackageRequestsAdmin(),
      ]);
      setAds(loadedAds);
      setTickets(loadedTickets);
      setPackageRequests(loadedRequests);
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل ملخص لوحة التحكم');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview, refreshTick]);

  const handleApproveAd = async (id: string) => {
    await updateAdAdmin(id, { status: 'approved' });
    await onTriggerRefresh();
  };

  const handleRejectAd = async (id: string) => {
    await updateAdAdmin(id, { status: 'rejected' });
    await onTriggerRefresh();
  };

  if (error) {
    return (
      <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
        <div className="w-7 h-7 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold text-slate-500">جاري تحميل الملخص...</p>
      </div>
    );
  }

  return (
    <AdminOverview
      ads={ads}
      tickets={tickets}
      packageRequests={packageRequests}
      onApproveAd={handleApproveAd}
      onRejectAd={handleRejectAd}
      onNavigateTab={(tab) => navigate(`/admin/${tab}`)}
      onOpenTicket={(ticketCode) =>
        navigate(`/admin/inbox?ticket=${encodeURIComponent(ticketCode)}`)
      }
    />
  );
}
