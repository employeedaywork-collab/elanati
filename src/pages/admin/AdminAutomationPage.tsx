import AdminAutomation from '../../components/admin/AdminAutomation';
import { useAdminContext } from './AdminLayout';

export default function AdminAutomationPage() {
  const { onTriggerRefresh } = useAdminContext();
  return <AdminAutomation onRefresh={onTriggerRefresh} />;
}
