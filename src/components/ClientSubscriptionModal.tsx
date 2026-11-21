import { X } from 'lucide-react';
import { Ad, SiteSettings } from '../types';
import ClientPortalView from './ClientPortalView';

interface ClientSubscriptionModalProps {
  settings: SiteSettings;
  categories?: string[];
  initialQuery?: string;
  onClose: () => void;
  onAddAd: () => void;
  onUpgrade: () => void;
  onRequestAdminEdit: (ad: Ad) => void;
  onRequestSupportTicket: (subject: string) => void;
  onAdUpdated?: () => Promise<void> | void;
}

export default function ClientSubscriptionModal({
  settings,
  categories,
  initialQuery = '',
  onClose,
  onAddAd,
  onUpgrade,
  onRequestAdminEdit,
  onRequestSupportTicket,
  onAdUpdated,
}: ClientSubscriptionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-50 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm rounded-t-3xl border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              متابعة اشتراكي وسجل الدفعات والإعلانات
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              تابع تفاصيل باقتك، سجل الدفعات بالجنيه المصري، العدّاد التنازلي، وتعديل إعلانك
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-slate-700" />
          </button>
        </div>

        <div className="p-6">
          <ClientPortalView
            settings={settings}
            categories={categories}
            initialQuery={initialQuery}
            onCloseModal={onClose}
            onAddAd={onAddAd}
            onUpgrade={onUpgrade}
            onRequestAdminEdit={onRequestAdminEdit}
            onRequestSupportTicket={onRequestSupportTicket}
            onAdUpdated={onAdUpdated}
          />
        </div>
      </div>
    </div>
  );
}
