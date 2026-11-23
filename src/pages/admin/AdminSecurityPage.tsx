import { useCallback, useEffect, useState } from 'react';
import AdminSecurityPanel from '../../components/admin/AdminSecurityPanel';
import {
  clearOldAccessLogsAdmin,
  deleteAdAdmin,
  fetchAccessLogsAdmin,
  fetchAdReportsAdmin,
  updateAdReportStatusAdmin,
} from '../../services/dataService';
import { AccessLogEntry, AdReport, AdReportStatus } from '../../types';
import { useAdminContext } from './AdminLayout';

export default function AdminSecurityPage() {
  const { refreshTick, onTriggerRefresh } = useAdminContext();
  const [logs, setLogs] = useState<AccessLogEntry[]>([]);
  const [reports, setReports] = useState<AdReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [loadedLogs, loadedReports] = await Promise.all([
        fetchAccessLogsAdmin(),
        fetchAdReportsAdmin(),
      ]);
      setLogs(loadedLogs);
      setReports(loadedReports);
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل سجل الأمان والبلاغات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshTick]);

  const handleUpdateReportStatus = async (id: string, status: AdReportStatus) => {
    await updateAdReportStatusAdmin(id, status);
    await onTriggerRefresh();
  };

  const handleDeleteReportedAd = async (adId: string, reportId: string) => {
    await deleteAdAdmin(adId);
    await updateAdReportStatusAdmin(reportId, 'reviewed');
    await onTriggerRefresh();
  };

  const handleClearOldLogs = async () => {
    await clearOldAccessLogsAdmin();
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
        <p className="text-xs font-bold text-slate-500">جاري تحميل سجل الأمان والبلاغات...</p>
      </div>
    );
  }

  return (
    <AdminSecurityPanel
      logs={logs}
      reports={reports}
      onUpdateReportStatus={handleUpdateReportStatus}
      onDeleteReportedAd={handleDeleteReportedAd}
      onClearOldLogs={handleClearOldLogs}
    />
  );
}
