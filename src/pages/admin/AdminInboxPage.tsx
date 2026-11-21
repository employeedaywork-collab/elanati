import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminInbox from '../../components/admin/AdminInbox';
import { fetchAllTicketsAdmin } from '../../services/dataService';
import { ContactMessage } from '../../types';
import { useAdminContext } from './AdminLayout';

export default function AdminInboxPage() {
  const [searchParams] = useSearchParams();
  const { session, refreshTick, onTriggerRefresh } = useAdminContext();
  const [tickets, setTickets] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const initialTicket = searchParams.get('ticket');

  const loadTickets = useCallback(async () => {
    setError('');
    try {
      const loadedTickets = await fetchAllTicketsAdmin();
      setTickets(loadedTickets);
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل رسائل العملاء');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets, refreshTick]);

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
        <p className="text-xs font-bold text-slate-500">جاري تحميل مركز الرسائل...</p>
      </div>
    );
  }

  return (
    <AdminInbox
      tickets={tickets}
      initialSelectedCode={initialTicket}
      adminName={session.fullName}
      onRefresh={onTriggerRefresh}
    />
  );
}
