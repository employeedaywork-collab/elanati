import { useCallback, useEffect, useState } from 'react';
import AdminAdsManager from '../../components/admin/AdminAdsManager';
import { DEFAULT_CATEGORIES } from '../../data/seedData';
import { fetchAllAdsAdmin, fetchCategories } from '../../services/dataService';
import { Ad } from '../../types';
import { useAdminContext } from './AdminLayout';

export default function AdminAdsPage() {
  const { refreshTick, onTriggerRefresh } = useAdminContext();
  const [ads, setAds] = useState<Ad[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAds = useCallback(async () => {
    setError('');
    try {
      const [loadedAds, loadedCats] = await Promise.all([
        fetchAllAdsAdmin(),
        fetchCategories(),
      ]);
      setAds(loadedAds);
      setCategories(loadedCats);
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل الإعلانات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAds();
  }, [loadAds, refreshTick]);

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
        <p className="text-xs font-bold text-slate-500">جاري تحميل الإعلانات...</p>
      </div>
    );
  }

  return <AdminAdsManager ads={ads} categories={categories} onRefresh={onTriggerRefresh} />;
}
