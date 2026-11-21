import { Receipt } from 'lucide-react';
import { Ad, SiteSettings } from '../types';
import ClientPortalView from './ClientPortalView';

interface SubscriptionsSectionProps {
  settings: SiteSettings;
  categories?: string[];
  onAddAd: () => void;
  onUpgrade: () => void;
  onRequestAdminEdit: (ad: Ad) => void;
  onRequestSupportTicket: (subject: string) => void;
  onAdUpdated: () => Promise<void>;
}

export default function SubscriptionsSection({
  settings,
  categories,
  onAddAd,
  onUpgrade,
  onRequestAdminEdit,
  onRequestSupportTicket,
  onAdUpdated,
}: SubscriptionsSectionProps) {
  return (
    <section id="subscriptions" className="py-20 bg-slate-50 border-t border-slate-200/70">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 max-w-2xl mx-auto">
          <p className="inline-flex items-center gap-1.5 text-blue-700 text-sm font-bold mb-2">
            <Receipt className="w-4 h-4" />
            بوابة المشتركين والدفعات
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 [text-wrap:balance]">
            قسم الاشتراكات وسجل الدفعات
          </h2>
          <p className="text-slate-600 text-base">
            تابع تفاصيل اشتراكك، سجل الدفعات بالجنيه المصري، العدّاد التنازلي للأيام المتبقية، وتحكم بتعديل إعلانك مباشرة من داخل المنصة
          </p>
        </div>

        <ClientPortalView
          settings={settings}
          categories={categories}
          onAddAd={onAddAd}
          onUpgrade={onUpgrade}
          onRequestAdminEdit={onRequestAdminEdit}
          onRequestSupportTicket={onRequestSupportTicket}
          onAdUpdated={onAdUpdated}
        />
      </div>
    </section>
  );
}
