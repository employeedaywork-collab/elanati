import { useState } from 'react';
import { Check, Copy, Eye, MapPin, MessageCircle, Phone, Send, Star, X } from 'lucide-react';
import { formatWhatsAppLink } from '../lib/supabase';
import { Ad } from '../types';

interface AdDetailsModalProps {
  ad: Ad;
  onClose: () => void;
  onInquireAdmin: (ad: Ad) => void;
}

export default function AdDetailsModal({ ad, onClose, onInquireAdmin }: AdDetailsModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(ad.contact);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const whatsappUrl = formatWhatsAppLink(
    ad.whatsapp || ad.contact,
    `مرحباً، أتواصل معك بخصوص إعلانك على منصة إعلاناتي: "${ad.title}"`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-6 py-4 flex items-center justify-between gap-4 z-10">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 tabular-nums">
            <span className="text-blue-700 font-bold">{ad.category}</span>
            <span aria-hidden="true">·</span>
            <span>{ad.city}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {ad.views_count} مشاهدة
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق التفاصيل"
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {ad.image_url && (
            <div className="h-56 sm:h-64 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
              <img
                src={ad.image_url}
                alt={ad.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="flex items-start gap-4">
            <span className="text-4xl leading-none shrink-0" aria-hidden="true">
              {ad.image}
            </span>
            <div>
              {ad.featured && (
                <div className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 mb-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  إعلان مميز
                </div>
              )}
              <h2 className="text-2xl font-extrabold text-slate-900 leading-snug">{ad.title}</h2>
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5 tabular-nums">
                <MapPin className="w-4 h-4 text-slate-400" />
                {ad.city} · نُشر في {ad.created_at.split('T')[0]}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80">
            <h3 className="text-sm font-bold text-slate-900 mb-2">تفاصيل العرض</h3>
            <p className="text-slate-700 leading-relaxed whitespace-pre-line text-base">
              {ad.description}
            </p>
          </div>

          <div className="border-t border-slate-100 pt-5 space-y-3">
            <div className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
              <div>
                <p className="text-xs text-slate-500">رقم تواصل المعلن</p>
                <p className="text-lg font-extrabold text-slate-900 tabular-nums">{ad.contact}</p>
              </div>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'تم النسخ' : 'نسخ الرقم'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href={`tel:${ad.contact}`}
                className="flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white py-3.5 px-5 rounded-xl font-bold text-sm transition-colors"
              >
                <Phone className="w-4 h-4" />
                اتصال مباشر بالمعلن
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 px-5 rounded-xl font-bold text-sm transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                تواصل عبر واتساب
              </a>
            </div>

            <button
              type="button"
              onClick={() => onInquireAdmin(ad)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-bold transition-colors"
            >
              <Send className="w-4 h-4 text-blue-700" />
              تواصل مع إدارة المنصة بخصوص هذا الإعلان
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
