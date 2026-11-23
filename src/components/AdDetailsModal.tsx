import { useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  Copy,
  Crown,
  Eye,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  Star,
  X,
} from 'lucide-react';
import { ITEM_CONDITION_LABELS, SPEC_LABELS } from '../data/seedData';
import { formatWhatsAppLink, sanitizeAdImageUrl, sanitizePhoneHref } from '../lib/supabase';
import {
  getFavoriteAdIds,
  getRemainingDays,
  submitAdReport,
  toggleFavoriteAdId,
} from '../services/dataService';
import { Ad } from '../types';
import GoogleMapLocationViewer from './GoogleMapLocationViewer';

interface AdDetailsModalProps {
  ad: Ad;
  onClose: () => void;
  onInquireAdmin: (ad: Ad) => void;
}

const REPORT_REASONS = [
  'محتوى مضلل أو احتيال',
  'سعر أو بيانات غير حقيقية',
  'إعلان مكرر أو سبام',
  'منتج أو نشاط مخالف للسياسات',
  'رقم تواصل غير صحيح',
];

export default function AdDetailsModal({ ad, onClose, onInquireAdmin }: AdDetailsModalProps) {
  const [copied, setCopied] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteAdIds());

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState('');

  const galleryImages = [ad.image_url, ad.banner_url, ...(ad.extra_images || [])]
    .map((url) => sanitizeAdImageUrl(url))
    .filter((url, index, arr): url is string => Boolean(url) && arr.indexOf(url) === index);
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const remainingDays = getRemainingDays(ad.expires_at);
  const isFav = favoriteIds.includes(ad.id);

  const specEntries = Object.entries(ad.specs || {}).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== ''
  );

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(ad.contact);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleToggleFavorite = () => {
    setFavoriteIds(toggleFavoriteAdId(ad.id));
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportError('');
    setReportBusy(true);
    try {
      await submitAdReport({
        adId: ad.id,
        adTitle: ad.title,
        reason: reportReason,
        details: reportDetails,
        reporterPhone,
      });
      setReportSent(true);
    } catch (err: any) {
      setReportError(err?.message || 'تعذر إرسال البلاغ حالياً');
    } finally {
      setReportBusy(false);
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
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 tabular-nums">
            <span className="text-blue-700 font-bold">{ad.category}</span>
            <span aria-hidden="true">·</span>
            <span>{ad.city}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {ad.views_count} مشاهدة
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleFavorite}
              aria-label={isFav ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border transition-colors ${
                isFav
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500' : ''}`} />
              <span>{isFav ? 'محفوظ' : 'حفظ'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق التفاصيل"
              className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {galleryImages.length > 0 && (
            <div className="space-y-2.5">
              <div className="h-56 sm:h-64 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                <img
                  src={galleryImages[activeImgIndex]}
                  alt={ad.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              {galleryImages.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {galleryImages.map((imgUrl, idx) => (
                    <button
                      key={`${imgUrl.slice(0, 48)}-${idx}`}
                      type="button"
                      onClick={() => setActiveImgIndex(idx)}
                      className={`w-16 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                        activeImgIndex === idx
                          ? 'border-blue-600 scale-105'
                          : 'border-slate-200 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={imgUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-start gap-4">
            <span className="text-4xl leading-none shrink-0" aria-hidden="true">
              {ad.image}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {(ad.package_name === 'المؤسسي' || ad.priority_rank === 2) && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                    <Crown className="w-3.5 h-3.5" />
                    الباقة المؤسسية
                  </span>
                )}
                {ad.featured && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    إعلان مميز
                  </span>
                )}
                {ad.item_condition && ad.item_condition !== 'unspecified' && (
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                    الحالة: {ITEM_CONDITION_LABELS[ad.item_condition]}
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 leading-snug">{ad.title}</h2>
              {typeof ad.price === 'number' && (
                <p className="text-xl font-extrabold text-emerald-700 mt-1.5 tabular-nums">
                  {ad.price.toLocaleString('en-US')} ج.م
                  {ad.price_negotiable && (
                    <span className="text-xs font-bold text-slate-500 mr-2">· قابل للتفاوض</span>
                  )}
                </p>
              )}
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5 tabular-nums">
                <MapPin className="w-4 h-4 text-slate-400" />
                {ad.city} · نُشر في {(ad.starts_at || ad.created_at).split('T')[0]}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <Calendar className="w-4 h-4 text-blue-700 shrink-0" />
              <div className="tabular-nums">
                <p className="text-slate-500">تاريخ النشر والانتهاء</p>
                <p className="font-bold text-slate-900">
                  {(ad.starts_at || ad.created_at).split('T')[0]} ←{' '}
                  {ad.expires_at ? ad.expires_at.split('T')[0] : 'ظهور دائم'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="tabular-nums">
                <p className="text-slate-500">المدة المتبقية للعرض</p>
                <p className="font-bold text-slate-900">
                  {remainingDays === null
                    ? 'إعلان دائم بدون انتهاء'
                    : `متبقي ${remainingDays} ${remainingDays === 1 ? 'يوم' : 'أيام'}`}
                </p>
              </div>
            </div>
          </div>

          {specEntries.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-xs font-extrabold text-slate-900 mb-3">المواصفات التفصيلية</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {specEntries.map(([key, val]) => (
                  <div key={key} className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                    <p className="text-[11px] text-slate-500">{SPEC_LABELS[key] || key}</p>
                    <p className="text-xs font-extrabold text-slate-900 mt-0.5 tabular-nums">
                      {String(val)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80">
            <h3 className="text-sm font-bold text-slate-900 mb-2">تفاصيل العرض</h3>
            <p className="text-slate-700 leading-relaxed whitespace-pre-line text-base">
              {ad.description}
            </p>
          </div>

          <GoogleMapLocationViewer
            latitude={ad.latitude}
            longitude={ad.longitude}
            locationAddress={ad.location_address}
            city={ad.city}
            title={ad.title}
          />

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
                href={`tel:${sanitizePhoneHref(ad.contact)}`}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onInquireAdmin(ad)}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors"
              >
                <Send className="w-4 h-4 text-blue-700" />
                تواصل مع إدارة المنصة بخصوص الإعلان
              </button>
              <button
                type="button"
                onClick={() => setReportOpen((v) => !v)}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold transition-colors"
              >
                <Flag className="w-4 h-4" />
                الإبلاغ عن إعلان مخالف
              </button>
            </div>

            {reportOpen && (
              <div className="p-4 rounded-2xl bg-red-50/70 border border-red-200 space-y-3">
                {reportSent ? (
                  <p className="text-xs font-bold text-emerald-800">
                    تم استلام بلاغك بنجاح وستقوم إدارة المنصة بمراجعته فوراً. شكراً لحرصك على أمان المنصة.
                  </p>
                ) : (
                  <form onSubmit={handleReportSubmit} className="space-y-3">
                    <p className="text-xs font-extrabold text-red-900">
                      إرسال بلاغ لإدارة المنصة لمراجعة هذا الإعلان
                    </p>
                    {reportError && (
                      <p className="text-xs font-bold text-red-700">{reportError}</p>
                    )}
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full px-3 py-2 border border-red-200 rounded-xl bg-white text-xs outline-none"
                    >
                      {REPORT_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      placeholder="رقم موبايلك للمتابعة (اختياري)"
                      value={reporterPhone}
                      onChange={(e) => setReporterPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-red-200 rounded-xl bg-white text-xs tabular-nums outline-none"
                    />
                    <textarea
                      rows={2}
                      placeholder="تفاصيل إضافية (اختياري)..."
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      className="w-full px-3 py-2 border border-red-200 rounded-xl bg-white text-xs resize-none outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={reportBusy}
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold"
                      >
                        {reportBusy ? 'جاري الإرسال...' : 'تأكيد إرسال البلاغ'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportOpen(false)}
                        className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-white"
                      >
                        إلغاء
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
