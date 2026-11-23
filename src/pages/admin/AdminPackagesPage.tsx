import { useCallback, useEffect, useState } from 'react';
import AdminPackagesManager from '../../components/admin/AdminPackagesManager';
import { INITIAL_PACKAGES } from '../../data/seedData';
import { fetchPackageRequestsAdmin, fetchPackages } from '../../services/dataService';
import { PackagePlan, PackageRequest } from '../../types';
import { useAdminContext } from './AdminLayout';

export default function AdminPackagesPage() {
  const { refreshTick, onTriggerRefresh } = useAdminContext();
  const [requests, setRequests] = useState<PackageRequest[]>([]);
  const [packages, setPackages] = useState<PackagePlan[]>(INITIAL_PACKAGES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPackages = useCallback(async (retryAttempt = 0) => {
    setError('');
    try {
      const [loadedRequests, loadedPackages] = await Promise.all([
        fetchPackageRequestsAdmin(),
        fetchPackages(),
      ]);
      setRequests(loadedRequests);
      setPackages(loadedPackages);
      setLoading(false);
    } catch (err: any) {
      if (retryAttempt < 1) {
        window.setTimeout(() => {
          void loadPackages(retryAttempt + 1);
        }, 650);
        return;
      }
      setError(err?.message || 'تعذر تحميل الاشتراكات والباقات');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages, refreshTick]);

  if (error) {
    return (
      <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center justify-between gap-3">
        <span>{error}</span>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void loadPackages();
          }}
          className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shrink-0"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
        <div className="w-7 h-7 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold text-slate-500">جاري تحميل الاشتراكات...</p>
      </div>
    );
  }

  return (
    <AdminPackagesManager requests={requests} packages={packages} onRefresh={onTriggerRefresh} />
  );
}
