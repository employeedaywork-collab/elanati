import { useNavigate } from 'react-router-dom';
import SubscriptionsSection from '../components/SubscriptionsSection';
import { usePublicContext } from '../components/PublicLayout';

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const {
    settings,
    categories,
    onAddAd,
    onRequestAdminEdit,
    onRequestSupportTicket,
    onRefreshData,
  } = usePublicContext();

  return (
    <div className="pt-16">
      <SubscriptionsSection
        settings={settings}
        categories={categories}
        onAddAd={onAddAd}
        onUpgrade={() => navigate('/packages')}
        onRequestAdminEdit={onRequestAdminEdit}
        onRequestSupportTicket={onRequestSupportTicket}
        onAdUpdated={onRefreshData}
      />
    </div>
  );
}
