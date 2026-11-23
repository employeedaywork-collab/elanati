import { useCallback, useEffect, useState } from 'react';
import AdminContentSettings from '../../components/admin/AdminContentSettings';
import { DEFAULT_SITE_SETTINGS } from '../../data/seedData';
import {
  fetchCategoryItemsAdmin,
  fetchSiteSettings,
  fetchTestimonials,
} from '../../services/dataService';
import { CategoryItem, SiteSettings, Testimonial } from '../../types';
import { useAdminContext } from './AdminLayout';

export default function AdminSettingsPage() {
  const { refreshTick, onTriggerRefresh } = useAdminContext();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [categoryItems, setCategoryItems] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSettings = useCallback(async (retryAttempt = 0) => {
    setError('');
    try {
      const [loadedSettings, loadedTestimonials, loadedCategories] = await Promise.all([
        fetchSiteSettings(),
        fetchTestimonials(true),
        fetchCategoryItemsAdmin(),
      ]);
      setSettings(loadedSettings);
      setTestimonials(loadedTestimonials);
      setCategoryItems(loadedCategories);
      setLoading(false);
    } catch (err: any) {
      if (retryAttempt < 1) {
        window.setTimeout(() => {
          void loadSettings(retryAttempt + 1);
        }, 650);
        return;
      }
      setError(err?.message || 'تعذر تحميل الإعدادات والمحتوى');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings, refreshTick]);

  if (error) {
    return (
      <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center justify-between gap-3">
        <span>{error}</span>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void loadSettings();
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
        <p className="text-xs font-bold text-slate-500">جاري تحميل الإعدادات...</p>
      </div>
    );
  }

  return (
    <AdminContentSettings
      settings={settings}
      testimonials={testimonials}
      categoryItems={categoryItems}
      onRefresh={onTriggerRefresh}
    />
  );
}
