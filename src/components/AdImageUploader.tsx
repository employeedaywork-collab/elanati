import { useRef, useState } from 'react';
import { Crown, ImagePlus, Link2, Loader2, Star, Trash2, Upload } from 'lucide-react';
import { sanitizeAdImageUrl } from '../lib/supabase';
import { uploadAdImage } from '../services/dataService';

interface AdImageUploaderProps {
  imageUrl: string;
  extraImages: string[];
  maxImages: number;
  onChange: (mainUrl: string, extras: string[]) => void;
  onUpgradeClick?: () => void;
}

export default function AdImageUploader({
  imageUrl,
  extraImages,
  maxImages,
  onChange,
  onUpgradeClick,
}: AdImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');

  const safeLimit = Math.max(1, Math.min(6, maxImages || 1));
  const currentImages = [imageUrl, ...extraImages]
    .map((u) => (u || '').trim())
    .filter(Boolean)
    .slice(0, safeLimit);

  const commitList = (list: string[]) => {
    const clean = list.map((u) => u.trim()).filter(Boolean).slice(0, safeLimit);
    onChange(clean[0] || '', clean.slice(1));
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError('');
    const remainingSlots = safeLimit - currentImages.length;
    if (remainingSlots <= 0) {
      setUploadError(`لقد وصلت للحد الأقصى لباقتك (${safeLimit} ${safeLimit === 1 ? 'صورة' : 'صور'}).`);
      return;
    }

    const toUpload = Array.from(files).slice(0, remainingSlots);
    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of toUpload) {
        const url = await uploadAdImage(file);
        uploadedUrls.push(url);
      }
      commitList([...currentImages, ...uploadedUrls]);
    } catch (err: any) {
      setUploadError(err?.message || 'تعذر رفع الصورة المحددة');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddByUrl = () => {
    setUploadError('');
    const trimmed = urlDraft.trim();
    if (!trimmed) return;
    const safe = sanitizeAdImageUrl(trimmed);
    if (!safe) {
      setUploadError('يرجى إدخال رابط صورة صحيح يبدأ بـ https:// أو http://');
      return;
    }
    if (currentImages.length >= safeLimit) {
      setUploadError(`الحد الأقصى المتاح لباقتك هو ${safeLimit} ${safeLimit === 1 ? 'صورة' : 'صور'}.`);
      return;
    }
    commitList([...currentImages, safe]);
    setUrlDraft('');
    setShowUrlInput(false);
  };

  const handleMakePrimary = (index: number) => {
    if (index <= 0 || index >= currentImages.length) return;
    const target = currentImages[index];
    const rest = currentImages.filter((_, i) => i !== index);
    commitList([target, ...rest]);
  };

  const handleRemove = (index: number) => {
    commitList(currentImages.filter((_, i) => i !== index));
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <ImagePlus className="w-4 h-4 text-blue-700" />
            صور الإعلان والمنتج
            <span className="text-xs font-bold text-slate-500 tabular-nums">
              ({currentImages.length} / {safeLimit})
            </span>
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {safeLimit === 1
              ? 'الباقة المجانية تسمح برفع صورة واحدة رئيسية (JPG / PNG / WebP).'
              : `متاح لباقتك رفع حتى ${safeLimit} صور عالية الجودة — الصورة الأولى هي الغلاف الرئيسي.`}
          </p>
        </div>

        {safeLimit === 1 && onUpgradeClick && (
          <button
            type="button"
            onClick={onUpgradeClick}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-extrabold transition-colors"
          >
            <Crown className="w-3.5 h-3.5" />
            ترقية لرفع 6 صور
          </button>
        )}
      </div>

      {uploadError && (
        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
          {uploadError}
        </div>
      )}

      {currentImages.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {currentImages.map((url, idx) => {
            const safeSrc = sanitizeAdImageUrl(url);
            return (
              <div
                key={`${url.slice(0, 48)}-${idx}`}
                className="relative group aspect-[4/3] rounded-xl overflow-hidden bg-slate-200 border border-slate-200"
              >
                {safeSrc ? (
                  <img
                    src={safeSrc}
                    alt={`صورة ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[11px] text-slate-500 p-2 text-center">
                    رابط غير صالح
                  </div>
                )}

                {idx === 0 && (
                  <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md bg-blue-700 text-white text-[10px] font-extrabold shadow-sm">
                    رئيسية
                  </span>
                )}

                <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => handleMakePrimary(idx)}
                      title="تعيين كصورة رئيسية"
                      className="p-1.5 rounded-lg bg-white/95 hover:bg-white text-amber-600 shadow-sm border border-slate-200"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    title="حذف الصورة"
                    className="p-1.5 rounded-lg bg-white/95 hover:bg-red-50 text-red-600 shadow-sm border border-slate-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {currentImages.length < safeLimit && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={safeLimit > 1}
            className="hidden"
            onChange={(e) => void handleFilesSelected(e.target.files)}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-bold transition-colors"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {uploading ? 'جاري ضغط ورفع الصورة...' : 'رفع صورة من الجهاز'}
          </button>

          <button
            type="button"
            onClick={() => setShowUrlInput((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            إضافة رابط صورة مباشر
          </button>
        </div>
      )}

      {showUrlInput && (
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="https://example.com/photo.jpg"
            dir="ltr"
            className="flex-1 px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-xs text-left outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="button"
            onClick={handleAddByUrl}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shrink-0"
          >
            إضافة الرابط
          </button>
        </div>
      )}
    </div>
  );
}
