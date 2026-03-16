import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Edit2,
  GripVertical,
  Images,
  Package,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ENDPOINTS, apiRequest, resolveAdminMediaUrl } from '../services/api';

/* ─────────────── types ─────────────── */

interface ApiProductImage {
  id: string;
  url: string;
  thumb_url?: string | null;
  sort_order?: number;
  created_at?: string | null;
}

interface ApiProduct {
  id: string;
  name: string;
  sku: string;
  image_url?: string | null;
  image_thumb_url?: string | null;
  images?: ApiProductImage[];
  size_liters: string;
  price_uzs: number;
  count: number;
  min_stock_threshold: number;
  availability_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  requires_returnable_bottle: boolean;
  bottle_deposit_uzs: number;
  is_active: boolean;
  updated_at: string | null;
}

interface ProductListResponse {
  results?: ApiProduct[];
  stock_summary?: {
    total_products?: number;
    active_products?: number;
    out_of_stock?: number;
  };
}

type ProductFormState = {
  name: string;
  sku: string;
  size_liters: string;
  price_uzs: string;
  count: string;
  min_stock_threshold: string;
  requires_returnable_bottle: boolean;
  bottle_deposit_uzs: string;
  is_active: boolean;
};

const emptyForm: ProductFormState = {
  name: '',
  sku: '',
  size_liters: '',
  price_uzs: '0',
  count: '0',
  min_stock_threshold: '5',
  requires_returnable_bottle: false,
  bottle_deposit_uzs: '0',
  is_active: true,
};

/* ─────────────── image helpers ─────────────── */

const getPrimaryImageCandidates = (
  product?: Pick<ApiProduct, 'image_url' | 'image_thumb_url' | 'images'> | null
): string[] =>
  [
    product?.image_thumb_url,
    product?.images?.[0]?.thumb_url,
    product?.image_url,
    product?.images?.[0]?.url,
  ]
    .map((v) => resolveAdminMediaUrl(v || null))
    .filter((v): v is string => Boolean(v))
    .filter((v, i, a) => a.indexOf(v) === i);

const getPrimaryImage = (
  product?: Pick<ApiProduct, 'image_url' | 'image_thumb_url' | 'images'> | null
): string | null => getPrimaryImageCandidates(product)[0] ?? null;

const getProductMedia = (
  product?: Pick<ApiProduct, 'image_url' | 'images'> | null
): ApiProductImage[] => {
  const items: ApiProductImage[] = [];
  const seen = new Set<string>();

  if (product?.image_url && !seen.has(product.image_url)) {
    seen.add(product.image_url);
    items.push({
      id: `primary-${product.image_url}`,
      url: resolveAdminMediaUrl(product.image_url) || product.image_url,
    });
  }

  (product?.images ?? []).forEach((img, idx) => {
    if (!img.url || seen.has(img.url)) return;
    seen.add(img.url);
    items.push({
      ...img,
      id: img.id || `img-${idx}-${img.url}`,
      url: resolveAdminMediaUrl(img.url) || img.url,
      thumb_url:
        resolveAdminMediaUrl(img.thumb_url || img.url) ||
        img.thumb_url ||
        img.url,
    });
  });

  return items;
};

/* ─────────────── ProductImage — smart URL fallback ─────────────── */

const ProductImage: React.FC<{
  candidates: string[];
  alt: string;
  className?: string;
  objectFit?: 'cover' | 'contain';
}> = ({ candidates, alt, className = '', objectFit = 'cover' }) => {
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  const key = candidates.join('|');
  useEffect(() => { setIdx(0); setFailed(false); }, [key]);

  const src = !failed && candidates[idx] ? candidates[idx] : null;

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-[#21404d] via-[#3d6c77] to-[#d9a25f] ${className}`}>
        <Package size={20} className="text-white/50" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={`${className} ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
      onError={() => {
        if (idx + 1 < candidates.length) setIdx((i) => i + 1);
        else setFailed(true);
      }}
    />
  );
};

/* ─────────────── GalleryThumb ─────────────── */

const GalleryThumb: React.FC<{
  image: ApiProductImage;
  isActive?: boolean;
  onClick: () => void;
  onRemove?: () => void;
  altText: string;
}> = ({ image, isActive, onClick, onRemove, altText }) => {
  const candidates = useMemo(
    () =>
      [image.thumb_url, image.url]
        .filter((v): v is string => Boolean(v))
        .filter((v, i, a) => a.indexOf(v) === i),
    [image.thumb_url, image.url]
  );

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border-2 transition-all duration-200 ${
        isActive !== undefined
          ? isActive
            ? 'border-[#21404d] shadow-md shadow-[#21404d]/20'
            : 'border-transparent hover:border-[#21404d]/30'
          : 'border-light-border dark:border-navy-700'
      }`}
      style={{ paddingBottom: '100%' }}
    >
      <button
        type="button"
        onClick={onClick}
        className="absolute inset-0 overflow-hidden rounded-[inherit]"
      >
        <ProductImage candidates={candidates} alt={altText} className="h-full w-full" objectFit="cover" />
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   ImageUploadPanel — professional inline component
═══════════════════════════════════════════════════ */

const ImageUploadPanel: React.FC<{
  editing: ApiProduct | null;
  uploadFiles: File[];
  uploadPreviewUrls: string[];
  existingGalleryImages: ApiProductImage[];
  displayPrimaryImage: string | null;
  removeImage: boolean;
  replaceGallery: boolean;
  removeImageIds: string[];
  formName: string;
  formSizeLiters: string;
  editorMediaCount: number;
  uploadInputRef: React.RefObject<HTMLInputElement>;
  saving: boolean;
  onFilesChange: (files: File[]) => void;
  onRemoveImageChange: (v: boolean) => void;
  onReplaceGalleryChange: (v: boolean) => void;
  onRemoveImageId: (id: string) => void;
  onRestoreImageId: (id: string) => void;
  tr: (en: string, ru: string, uz: string) => string;
}> = ({
  editing,
  uploadFiles,
  uploadPreviewUrls,
  existingGalleryImages,
  displayPrimaryImage,
  removeImage,
  replaceGallery,
  removeImageIds,
  formName,
  formSizeLiters,
  editorMediaCount,
  uploadInputRef,
  saving,
  onFilesChange,
  onRemoveImageChange,
  onReplaceGalleryChange,
  onRemoveImageId,
  onRestoreImageId,
  tr,
}) => {
  const [draggingOver, setDraggingOver] = useState(false);
  const [dragSrcIdx, setDragSrcIdx] = useState<number | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) setDraggingOver(false);
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDraggingOver(false);
      const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
      if (dropped.length) onFilesChange([...uploadFiles, ...dropped]);
    },
    [uploadFiles, onFilesChange]
  );

  const startDragThumb = (i: number) => setDragSrcIdx(i);
  const dropOnThumb = (targetIdx: number) => {
    if (dragSrcIdx === null || dragSrcIdx === targetIdx) { setDragSrcIdx(null); return; }
    const next = [...uploadFiles];
    const [item] = next.splice(dragSrcIdx, 1);
    next.splice(targetIdx, 0, item);
    onFilesChange(next);
    setDragSrcIdx(null);
  };

  const removeUpload = (i: number) => {
    onFilesChange(uploadFiles.filter((_, fi) => fi !== i));
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  const clearQueue = () => {
    onFilesChange([]);
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  const pickFiles = () => uploadInputRef.current?.click();

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (picked.length) onFilesChange([...uploadFiles, ...picked]);
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  const hasExisting = existingGalleryImages.length > 0;
  const hasUploads = uploadFiles.length > 0;
  const showRemoveMainToggle = Boolean(editing && (editing.image_url || editing.image_thumb_url));
  const showReplaceToggle = (editing?.images?.length ?? 0) > 0;

  return (
    <section className="space-y-3">

      {/* ── HERO PREVIEW ── */}
      <div
        className="relative w-full overflow-hidden rounded-[22px] shadow-[0_16px_48px_rgba(33,64,77,0.18)]"
        style={{ aspectRatio: '4/3', background: 'linear-gradient(135deg,#21404d 0%,#3d6c77 55%,#c9894a 100%)' }}
      >
        {displayPrimaryImage ? (
          <img
            key={displayPrimaryImage}
            src={displayPrimaryImage}
            alt={formName || 'Preview'}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Package size={36} strokeWidth={1.4} className="text-white/30" />
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">
              {tr('Upload a photo', 'Загрузите фото', 'Rasm yuklang')}
            </span>
          </div>
        )}

        {/* bottom caption */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent px-4 pb-4 pt-14 pointer-events-none">
          <p className="text-[13px] font-semibold leading-tight text-white">
            {formName || tr('New product', 'Новый товар', 'Yangi mahsulot')}
          </p>
          <p className="mt-0.5 text-[11px] text-white/50">
            {formSizeLiters ? `${formSizeLiters}L · ` : ''}
            {editorMediaCount} {tr('photos', 'фото', 'rasm')}
          </p>
        </div>

        {/* saving spinner overlay */}
        {saving && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-sm">
            <div className="h-8 w-8 rounded-full border-[3px] border-white/25 border-t-white animate-spin" />
            <p className="text-[11px] font-semibold text-white">
              {tr('Saving…', 'Сохранение…', 'Saqlanmoqda…')}
            </p>
          </div>
        )}
      </div>

      {/* ── UPLOAD PANEL ── */}
      <div className="overflow-hidden rounded-[18px] border border-light-border bg-white/80 shadow-sm dark:border-navy-700 dark:bg-navy-900/50">

        {/* panel header */}
        <div className="flex items-center justify-between gap-2 border-b border-light-border px-4 py-3 dark:border-navy-700">
          <div className="flex items-center gap-2">
            <Images size={14} className="text-[#21404d] dark:text-[#8bbec8]" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {tr('Product photos', 'Фото товара', 'Mahsulot rasmlari')}
            </span>
            {editorMediaCount > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#21404d] px-1.5 text-[10px] font-bold text-white">
                {editorMediaCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasUploads && (
              <button
                type="button"
                onClick={clearQueue}
                className="text-[11px] text-rose-400 transition-colors hover:text-rose-600"
              >
                {tr('Clear new', 'Очистить', 'Tozalash')}
              </button>
            )}
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#21404d] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#1a3340]">
              <CloudUpload size={12} />
              {hasUploads || hasExisting ? tr('Add more', 'Ещё', 'Yana') : tr('Browse', 'Выбрать', 'Tanlash')}
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={onInputChange}
              />
            </label>
          </div>
        </div>

        {/* ── DROP ZONE (when no uploads queued) ── */}
        {!hasUploads && (
          <div
            ref={dropZoneRef}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={pickFiles}
            className={[
              'mx-4 my-3 cursor-pointer rounded-xl border-2 border-dashed px-4 py-7 text-center transition-all duration-150',
              draggingOver
                ? 'scale-[1.01] border-[#21404d] bg-[rgba(33,64,77,0.06)]'
                : 'border-light-border hover:border-[#21404d]/40 hover:bg-gray-50/60 dark:border-navy-600 dark:hover:bg-navy-800/30',
            ].join(' ')}
          >
            <div className={[
              'mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors',
              draggingOver ? 'bg-[#21404d]' : 'bg-gray-100 dark:bg-navy-700',
            ].join(' ')}>
              <CloudUpload size={18} className={draggingOver ? 'text-white' : 'text-gray-400'} />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {tr('Drag & drop images here', 'Перетащите изображения сюда', 'Rasmlarni bu yerga tashlang')}
            </p>
            <p className="mt-0.5 text-[11px] text-gray-400">
              {tr('or click to browse', 'или нажмите для выбора', 'yoki tanlash uchun bosing')}
            </p>
            <p className="mt-2 text-[10px] text-gray-300 dark:text-gray-500">
              JPG · PNG · WebP
            </p>
          </div>
        )}

        {/* ── NEW UPLOADS QUEUE ── */}
        {hasUploads && (
          <div className="px-4 pb-1 pt-3">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#355cbb]">
                {tr('New', 'Новые', 'Yangi')} · {uploadFiles.length}
              </span>
              {uploadFiles.length > 1 && (
                <span className="text-[10px] text-gray-400">
                  — {tr('drag to reorder', 'потяните для сортировки', 'tartib uchun suring')}
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {uploadPreviewUrls.map((url, i) => (
                <div
                  key={`upl-${i}`}
                  draggable
                  onDragStart={() => startDragThumb(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropOnThumb(i)}
                  className={[
                    'group relative cursor-grab overflow-hidden rounded-xl border-2 transition-all duration-150 active:cursor-grabbing',
                    dragSrcIdx === i
                      ? 'scale-95 opacity-40'
                      : 'border-[#355cbb]/40 hover:border-[#355cbb]',
                  ].join(' ')}
                  style={{ paddingBottom: '100%' }}
                >
                  <div className="absolute inset-0">
                    <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
                  </div>
                  {/* Main badge on first */}
                  {i === 0 && (
                    <div className="absolute left-1 top-1 z-10 flex items-center gap-0.5 rounded bg-[#21404d]/80 px-1.5 py-0.5 backdrop-blur-sm">
                      <Star size={7} className="fill-amber-300 text-amber-300" />
                      <span className="text-[8px] font-bold uppercase tracking-wide text-white">
                        {tr('Main', 'Главное', 'Asosiy')}
                      </span>
                    </div>
                  )}
                  {/* Drag handle */}
                  <div className="absolute bottom-1 left-1 z-10 flex h-5 w-5 items-center justify-center rounded bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <GripVertical size={10} className="text-white" />
                  </div>
                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeUpload(i)}
                    className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500"
                  >
                    <X size={9} />
                  </button>
                </div>
              ))}

              {/* Drop-more slot */}
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={pickFiles}
                className={[
                  'relative flex cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors',
                  draggingOver
                    ? 'border-[#21404d] bg-[rgba(33,64,77,0.07)]'
                    : 'border-gray-200 hover:border-[#21404d]/50 hover:bg-gray-50 dark:border-navy-600 dark:hover:bg-navy-800/30',
                ].join(' ')}
                style={{ paddingBottom: '100%' }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <CloudUpload size={15} className={draggingOver ? 'text-[#21404d]' : 'text-gray-300 dark:text-gray-500'} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── EXISTING GALLERY ── */}
        {hasExisting && (
          <div className="px-4 pb-1 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9a6b3a]">
                {tr('Existing', 'Текущие', 'Joriy')} · {existingGalleryImages.length}
              </span>
              {removeImageIds.length > 0 && (
                <span className="text-[10px] text-rose-400">
                  {removeImageIds.length} {tr('to remove', 'удалить', "o'chirish")}
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {existingGalleryImages.map((img) => {
                const marked = removeImageIds.includes(img.id);
                const thumb = img.thumb_url || img.url;
                return (
                  <div
                    key={img.id}
                    className={[
                      'group relative overflow-hidden rounded-xl border-2 transition-all duration-150',
                      marked
                        ? 'border-rose-400/50 opacity-50 grayscale'
                        : 'border-transparent hover:border-[#21404d]/30',
                    ].join(' ')}
                    style={{ paddingBottom: '100%' }}
                  >
                    <div className="absolute inset-0">
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    </div>
                    {marked ? (
                      <button
                        type="button"
                        onClick={() => onRestoreImageId(img.id)}
                        className="absolute inset-0 z-10 flex items-center justify-center bg-rose-500/15 transition-colors hover:bg-rose-500/25"
                        title={tr('Restore', 'Восстановить', 'Tiklash')}
                      >
                        <RotateCcw size={13} className="text-rose-500" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onRemoveImageId(img.id)}
                        className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500"
                      >
                        <X size={9} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── OPTION TOGGLES ── */}
        {(showRemoveMainToggle || showReplaceToggle) && (
          <div className="mx-4 mb-4 mt-3 space-y-2 rounded-xl border border-light-border bg-gray-50/70 px-3 py-3 dark:border-navy-700 dark:bg-navy-900/40">
            {showRemoveMainToggle && (
              <label className="flex cursor-pointer select-none items-center gap-2.5 text-[12px] text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={removeImage}
                  onChange={(e) => onRemoveImageChange(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-rose-500"
                />
                <Trash2 size={11} className="shrink-0 text-rose-400" />
                {tr('Remove current main photo', 'Удалить главное фото', 'Asosiy rasmni olib tashlash')}
              </label>
            )}
            {showReplaceToggle && (
              <label className="flex cursor-pointer select-none items-center gap-2.5 text-[12px] text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={replaceGallery}
                  onChange={(e) => onReplaceGalleryChange(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-amber-500"
                />
                <RotateCcw size={11} className="shrink-0 text-amber-400" />
                {tr('Replace entire gallery on save', 'Заменить всю галерею при сохр.', "Saqlashda galereyani almashtirish")}
              </label>
            )}
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {!hasUploads && !hasExisting && (
          <p className="px-4 pb-4 pt-1 text-center text-[11px] text-gray-400 dark:text-gray-500">
            {tr("No photos yet.", "Фото пока нет.", "Hali rasm yo'q.")}
          </p>
        )}
      </div>
    </section>
  );
};

/* ═══════════════════════ Products page ═══════════════════════ */

const Products: React.FC = () => {
  const { t, language } = useLanguage();
  const toast = useToast();
  const tr = (en: string, ru: string, uz: string) =>
    language === 'ru' ? ru : language === 'uz' ? uz : en;

  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ApiProduct | null>(null);
  const [formState, setFormState] = useState<ProductFormState>(emptyForm);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadPreviewUrls, setUploadPreviewUrls] = useState<string[]>([]);
  const [removeImage, setRemoveImage] = useState(false);
  const [removeImageIds, setRemoveImageIds] = useState<string[]>([]);
  const [replaceGallery, setReplaceGallery] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [detailProduct, setDetailProduct] = useState<ApiProduct | null>(null);
  const [detailIndex, setDetailIndex] = useState(0);
  const [stockSummary, setStockSummary] = useState<ProductListResponse['stock_summary'] | null>(null);

  /* ── data ── */
  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (onlyLowStock) params.set('low_stock', 'true');
      const q = params.toString() ? `?${params.toString()}` : '';
      const res = await apiRequest<ProductListResponse>(`${ENDPOINTS.PRODUCTS.LIST_CREATE}${q}`);
      setProducts(res.results ?? []);
      setStockSummary(res.stock_summary ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : tr('Failed to load products', 'Не удалось загрузить товары', "Mahsulotlarni yuklab bo'lmadi");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadProducts(); }, [onlyLowStock]);

  useEffect(() => {
    if (!uploadFiles.length) { setUploadPreviewUrls([]); return; }
    const urls = uploadFiles.map((f) => URL.createObjectURL(f));
    setUploadPreviewUrls(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [uploadFiles]);

  useEffect(() => {
    if (!editing) {
      setFormState(emptyForm);
      setUploadFiles([]);
      setRemoveImage(false);
      setRemoveImageIds([]);
      setReplaceGallery(false);
      return;
    }
    setFormState({
      name: editing.name ?? '',
      sku: editing.sku ?? '',
      size_liters: editing.size_liters ?? '',
      price_uzs: String(editing.price_uzs ?? 0),
      count: String(editing.count ?? 0),
      min_stock_threshold: String(editing.min_stock_threshold ?? 5),
      requires_returnable_bottle: Boolean(editing.requires_returnable_bottle),
      bottle_deposit_uzs: String(editing.bottle_deposit_uzs ?? 0),
      is_active: editing.is_active !== false,
    });
    setUploadFiles([]);
    setRemoveImage(false);
    setRemoveImageIds([]);
    setReplaceGallery(false);
  }, [editing]);

  const existingGalleryImages = useMemo(
    () =>
      (replaceGallery ? [] : (editing?.images ?? []))
        .filter((img) => !removeImageIds.includes(img.id || `img-fallback-${img.url}`))
        .map((img, idx) => ({
          ...img,
          id: img.id || `img-${idx}-${img.url}`,
          url: resolveAdminMediaUrl(img.url) || img.url,
          thumb_url: resolveAdminMediaUrl(img.thumb_url || img.url) || img.thumb_url || img.url,
        })),
    [editing?.images, removeImageIds, replaceGallery]
  );

  const displayPrimaryImage = useMemo(() => {
    if (uploadPreviewUrls[0]) return uploadPreviewUrls[0];
    if (removeImage) return null;
    return getPrimaryImage(editing);
  }, [editing, removeImage, uploadPreviewUrls]);

  const detailMedia = useMemo(() => getProductMedia(detailProduct), [detailProduct]);

  const productStats = useMemo(() => ({
    totalProducts: stockSummary?.total_products ?? products.length,
    activeProducts: stockSummary?.active_products ?? products.filter((p) => p.is_active !== false).length,
    outOfStock: stockSummary?.out_of_stock ?? products.filter((p) => p.availability_status === 'out_of_stock').length,
  }), [products, stockSummary]);

  const editorPrice = Number(formState.price_uzs || 0);
  const editorStock = Number(formState.count || 0);
  const editorMinThreshold = Number(formState.min_stock_threshold || 0);
  const editorDeposit = formState.requires_returnable_bottle ? Number(formState.bottle_deposit_uzs || 0) : 0;
  const editorStatus: ApiProduct['availability_status'] =
    editorStock <= 0 ? 'out_of_stock' : editorStock <= editorMinThreshold ? 'low_stock' : 'in_stock';
  const editorMediaCount = existingGalleryImages.length + uploadFiles.length;

  const resetImageInputs = () => { if (uploadInputRef.current) uploadInputRef.current.value = ''; };

  const openCreate = () => {
    setEditing(null); setFormState(emptyForm); setUploadFiles([]);
    setRemoveImage(false); setRemoveImageIds([]); setReplaceGallery(false);
    resetImageInputs(); setIsEditorOpen(true);
  };
  const openEdit = (p: ApiProduct) => { setEditing(p); resetImageInputs(); setIsEditorOpen(true); };
  const closeEditor = () => {
    setIsEditorOpen(false); setEditing(null); setFormState(emptyForm); setUploadFiles([]);
    setRemoveImage(false); setRemoveImageIds([]); setReplaceGallery(false); resetImageInputs();
  };
  const openDetail = (p: ApiProduct, start = 0) => {
    const media = getProductMedia(p);
    setDetailProduct(p);
    setDetailIndex(media.length ? Math.min(Math.max(start, 0), media.length - 1) : 0);
  };
  const closeDetail = () => { setDetailProduct(null); setDetailIndex(0); };
  const shiftDetail = (dir: number) => {
    if (!detailMedia.length) return;
    setDetailIndex((cur) => (cur + dir + detailMedia.length) % detailMedia.length);
  };

  const availabilityBadge = (status: ApiProduct['availability_status']) => {
    if (status === 'in_stock') return <Badge variant="success">{tr('In stock', 'В наличии', 'Mavjud')}</Badge>;
    if (status === 'low_stock') return <Badge variant="warning">{tr('Low stock', 'Мало', 'Kam')}</Badge>;
    return <Badge variant="error">{tr('Out of stock', 'Нет', 'Tugagan')}</Badge>;
  };

  const fmtDate = (v?: string | null) => {
    if (!v) return '-';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-UZ' : 'en-US', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(d);
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); void loadProducts(); };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setSaving(true); setError(null);
      const hasMedia = Boolean(uploadFiles.length || removeImage || removeImageIds.length || replaceGallery);

      if (hasMedia) {
        const fd = new FormData();
        fd.append('name', formState.name.trim());
        if (editing || formState.sku.trim()) fd.append('sku', formState.sku.trim());
        fd.append('size_liters', formState.size_liters.trim());
        fd.append('price_uzs', String(Number(formState.price_uzs || 0)));
        fd.append('count', String(Number(formState.count || 0)));
        fd.append('min_stock_threshold', String(Number(formState.min_stock_threshold || 5)));
        fd.append('requires_returnable_bottle', String(formState.requires_returnable_bottle));
        fd.append('bottle_deposit_uzs', String(formState.requires_returnable_bottle ? Number(formState.bottle_deposit_uzs || 0) : 0));
        fd.append('is_active', String(formState.is_active));
        fd.append('actor', 'frontend-ui');

        // ── image upload: single → 'image', multiple → 'images[]' ──
        if (uploadFiles.length === 1) {
          fd.append('image', uploadFiles[0]);
        } else {
          uploadFiles.forEach((f) => fd.append('images[]', f));
        }

        if (replaceGallery) fd.append('replace_images', 'true');
        if (removeImage) fd.append('remove_image', 'true');
        if (removeImageIds.length) fd.append('remove_image_ids', JSON.stringify(removeImageIds));

        await apiRequest(
          editing ? ENDPOINTS.PRODUCTS.DETAIL(editing.id) : ENDPOINTS.PRODUCTS.LIST_CREATE,
          { method: editing ? 'PATCH' : 'POST', body: fd }
        );
      } else {
        const body: Record<string, unknown> = {
          name: formState.name.trim(),
          size_liters: formState.size_liters.trim(),
          price_uzs: Number(formState.price_uzs || 0),
          count: Number(formState.count || 0),
          min_stock_threshold: Number(formState.min_stock_threshold || 5),
          requires_returnable_bottle: formState.requires_returnable_bottle,
          bottle_deposit_uzs: formState.requires_returnable_bottle ? Number(formState.bottle_deposit_uzs || 0) : 0,
          is_active: formState.is_active,
          actor: 'frontend-ui',
        };
        if (editing || formState.sku.trim()) body.sku = formState.sku.trim();
        await apiRequest(
          editing ? ENDPOINTS.PRODUCTS.DETAIL(editing.id) : ENDPOINTS.PRODUCTS.LIST_CREATE,
          { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) }
        );
      }

      closeEditor();
      await loadProducts();
      toast.success(
        editing
          ? tr('Product updated.', 'Товар обновлён.', 'Mahsulot yangilandi.')
          : tr('Product created.', 'Товар создан.', 'Mahsulot yaratildi.')
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : tr('Failed to save product', 'Не удалось сохранить товар', "Mahsulotni saqlab bo'lmadi");
      setError(msg); toast.error(msg);
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (product: ApiProduct) => {
    if (!window.confirm(tr(`Deactivate "${product.name}"?`, `Деактивировать "${product.name}"?`, `"${product.name}" nofaol qilinsinmi?`))) return;
    try {
      await apiRequest(ENDPOINTS.PRODUCTS.DETAIL(product.id), { method: 'PATCH', body: JSON.stringify({ is_active: false }) });
      await loadProducts();
      toast.success(tr('Product deactivated.', 'Товар деактивирован.', 'Mahsulot nofaol qilindi.'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : tr('Failed', 'Ошибка', 'Xatolik');
      setError(msg); toast.error(msg);
    }
  };

  /* ══════════════════════ render ══════════════════════ */
  return (
    <div className="space-y-6">

      {/* ── header ── */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-light-text dark:text-white">{t('nav_products')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            {tr(
              'Manage products, stock, and photos in one clean workspace.',
              'Управляйте товарами, остатками и фото в одном удобном месте.',
              "Mahsulotlar, qoldiq va rasmlarni bitta toza oynada boshqaring."
            )}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-blue px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600"
        >
          <Plus size={14} /> {t('create')}
        </button>
      </div>

      {/* ── stat cards ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: tr('Total products', 'Всего товаров', 'Jami mahsulotlar'), value: productStats.totalProducts, color: '#9a6b3a', bg: 'rgba(255,247,237,0.94)' },
          { label: tr('Active products', 'Активные товары', 'Faol mahsulotlar'), value: productStats.activeProducts, color: '#40635b', bg: 'rgba(232,241,238,0.94)' },
          { label: tr('Out of stock', 'Нет в наличии', 'Tugagan'), value: productStats.outOfStock, color: '#355cbb', bg: 'rgba(236,242,255,0.94)' },
        ].map(({ label, value, color, bg }) => (
          <div
            key={label}
            className="rounded-2xl border border-light-border bg-white p-5 shadow-sm dark:border-navy-700 dark:bg-navy-800"
            style={{ background: `linear-gradient(135deg, ${bg} 0%, rgba(255,255,255,1) 100%)` }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color }}>{label}</p>
            <p className="mt-2 text-3xl font-bold text-[#1f2933]">{value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── catalog ── */}
      <Card className="!p-0 overflow-hidden">
        {/* toolbar */}
        <form onSubmit={handleSearch} className="border-b border-light-border bg-white p-4 dark:border-navy-700 dark:bg-navy-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {tr('Products catalog', 'Каталог товаров', 'Mahsulotlar katalogi')}
            </p>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 dark:border-navy-600 dark:bg-navy-900 dark:text-gray-300">
                <input type="checkbox" checked={onlyLowStock} onChange={(e) => setOnlyLowStock(e.target.checked)} />
                {tr('Low stock only', 'Только мало', 'Faqat kam')}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`${t('search')}…`}
                  className="w-56 rounded-lg border border-light-border bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </form>

        {/* ── product list ── */}
        <div className="divide-y divide-light-border dark:divide-navy-700">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-400">
              {tr('Loading products…', 'Товары загружаются…', 'Mahsulotlar yuklanmoqda…')}
            </div>
          ) : products.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">
              {tr('No products found.', 'Товары не найдены.', 'Mahsulotlar topilmadi.')}
            </div>
          ) : (
            products.map((product) => {
              const media = getProductMedia(product);
              const candidates = getPrimaryImageCandidates(product);
              const mediaCount = media.length;

              return (
                <div
                  key={product.id}
                  onClick={() => openDetail(product)}
                  className="flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-gray-50/70 dark:hover:bg-navy-800/60"
                >
                  {/* thumbnail */}
                  <div className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-light-border dark:border-navy-700">
                    <ProductImage
                      candidates={candidates}
                      alt={product.name}
                      className="h-full w-full transition-transform duration-300 group-hover:scale-110"
                      objectFit="cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                      <ZoomIn size={13} className="text-white" />
                    </div>
                  </div>

                  {/* main info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-gray-900 dark:text-white">{product.name}</span>
                      {availabilityBadge(product.availability_status)}
                      {product.is_active === false && (
                        <Badge variant="default">{tr('Inactive', 'Неакт.', 'Nofaol')}</Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
                      <span className="font-mono text-[11px]">{product.sku}</span>
                      <span>{product.size_liters}L</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {product.price_uzs.toLocaleString()} UZS
                      </span>
                      <span>
                        {tr('Stock', 'Остаток', 'Qoldiq')}:{' '}
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{product.count}</span>
                      </span>
                      {mediaCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                          <Images size={11} /> {mediaCount}
                        </span>
                      )}
                      {product.requires_returnable_bottle && product.bottle_deposit_uzs > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {tr('Deposit', 'Депозит', 'Depozit')}: {product.bottle_deposit_uzs.toLocaleString()} UZS
                        </span>
                      )}
                    </div>
                  </div>

                  {/* actions */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEdit(product); }}
                      title={tr('Edit', 'Изменить', 'Tahrirlash')}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#21404d] text-white transition hover:brightness-110"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleDeactivate(product); }}
                      title={tr('Deactivate', 'Деактивировать', 'Nofaol qilish')}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-500 transition hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* ══════════════════ EDITOR MODAL ══════════════════ */}
      <Modal
        isOpen={isEditorOpen}
        onClose={closeEditor}
        title={
          editing
            ? tr('Edit Product', 'Редактировать товар', 'Mahsulotni tahrirlash')
            : tr('Add New Product', 'Добавить товар', "Yangi mahsulot qo'shish")
        }
        footer={null}
        maxWidthClass="max-w-5xl"
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_1.35fr]">

            {/* ── left: professional image upload panel ── */}
            <ImageUploadPanel
              editing={editing}
              uploadFiles={uploadFiles}
              uploadPreviewUrls={uploadPreviewUrls}
              existingGalleryImages={existingGalleryImages}
              displayPrimaryImage={displayPrimaryImage}
              removeImage={removeImage}
              replaceGallery={replaceGallery}
              removeImageIds={removeImageIds}
              formName={formState.name}
              formSizeLiters={formState.size_liters}
              editorMediaCount={editorMediaCount}
              uploadInputRef={uploadInputRef as React.RefObject<HTMLInputElement>}
              saving={saving}
              onFilesChange={setUploadFiles}
              onRemoveImageChange={setRemoveImage}
              onReplaceGalleryChange={(v) => {
                setReplaceGallery(v);
                if (v) setRemoveImageIds([]);
              }}
              onRemoveImageId={(id) =>
                setRemoveImageIds((cur) => (cur.includes(id) ? cur : [...cur, id]))
              }
              onRestoreImageId={(id) =>
                setRemoveImageIds((cur) => cur.filter((x) => x !== id))
              }
              tr={tr}
            />

            {/* ── right: fields + live preview ── */}
            <section className="space-y-4">
              <div className="rounded-[20px] border border-light-border bg-white/80 p-5 shadow-sm dark:border-navy-700 dark:bg-navy-900/40">
                <p className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                  {tr('Product details', 'Детали товара', 'Mahsulot tafsilotlari')}
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                  {/* name */}
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{t('product_name')}</label>
                    <input
                      value={formState.name}
                      onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))}
                      required
                      className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                    />
                  </div>

                  {/* SKU */}
                  {editing ? (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">SKU</label>
                      <input
                        value={formState.sku}
                        onChange={(e) => setFormState((p) => ({ ...p, sku: e.target.value }))}
                        placeholder={tr('Auto-generated', 'Авто', 'Avtomatik')}
                        className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                      />
                    </div>
                  ) : (
                    <div className="md:col-span-2 rounded-xl border border-light-border bg-gray-50/60 px-3 py-2 text-xs text-gray-400 dark:border-navy-600 dark:bg-navy-900/40">
                      {tr('SKU auto-generated after save.', 'SKU будет создан автоматически.', "SKU avtomatik yaratiladi.")}
                    </div>
                  )}

                  {/* size */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                      {tr('Size (L)', 'Объем (Л)', 'Hajm (L)')}
                    </label>
                    <input
                      value={formState.size_liters}
                      onChange={(e) => setFormState((p) => ({ ...p, size_liters: e.target.value }))}
                      required
                      className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                    />
                  </div>

                  {/* price */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{t('price')} (UZS)</label>
                    <input
                      type="number" min="0"
                      value={formState.price_uzs}
                      onChange={(e) => setFormState((p) => ({ ...p, price_uzs: e.target.value }))}
                      required
                      className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                    />
                  </div>

                  {/* stock */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{t('stock')}</label>
                    <input
                      type="number" min="0"
                      value={formState.count}
                      onChange={(e) => setFormState((p) => ({ ...p, count: e.target.value }))}
                      required
                      className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                    />
                  </div>

                  {/* min threshold */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                      {tr('Min threshold', 'Мин. порог', 'Min. chegara')}
                    </label>
                    <input
                      type="number" min="0"
                      value={formState.min_stock_threshold}
                      onChange={(e) => setFormState((p) => ({ ...p, min_stock_threshold: e.target.value }))}
                      required
                      className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                    />
                  </div>

                  {/* bottle deposit */}
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                      {tr('Bottle deposit (UZS)', 'Депозит бутыли (UZS)', 'Idish depoziti (UZS)')}
                    </label>
                    <input
                      type="number" min="0"
                      value={formState.bottle_deposit_uzs}
                      onChange={(e) => setFormState((p) => ({ ...p, bottle_deposit_uzs: e.target.value }))}
                      disabled={!formState.requires_returnable_bottle}
                      className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue disabled:opacity-40 dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                    />
                  </div>

                  {/* toggles */}
                  <div className="md:col-span-2 flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={formState.requires_returnable_bottle}
                        onChange={(e) => setFormState((p) => ({
                          ...p,
                          requires_returnable_bottle: e.target.checked,
                          bottle_deposit_uzs: e.target.checked ? p.bottle_deposit_uzs : '0',
                        }))}
                      />
                      {tr('Returnable bottle', 'Возвратная тара', 'Qaytariladigan idish')}
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={formState.is_active}
                        onChange={(e) => setFormState((p) => ({ ...p, is_active: e.target.checked }))}
                      />
                      {tr('Active', 'Активный', 'Faol')}
                    </label>
                  </div>
                </div>

                {/* live preview mini-cards */}
                <div className="mt-5 space-y-3 border-t border-light-border pt-4 dark:border-navy-700">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[linear-gradient(135deg,rgba(255,247,237,0.96)_0%,rgba(255,255,255,1)_100%)] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9a6b3a]">SKU</p>
                      <p className="mt-1 text-sm font-semibold text-[#1f2933]">
                        {formState.sku || tr('Auto', 'Авто', 'Avto')}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[linear-gradient(135deg,rgba(236,242,255,0.96)_0%,rgba(255,255,255,1)_100%)] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#355cbb]">
                        {tr('Updated', 'Обновлено', 'Yangilangan')}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#1f2933]">
                        {editing ? fmtDate(editing.updated_at) : tr('Not saved', 'Не сохранено', 'Saqlanmagan')}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-light-border bg-white p-3 dark:border-navy-700 dark:bg-navy-800">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#40635b]">{t('price')}</p>
                      <p className="mt-1 text-lg font-bold text-[#1f2933] dark:text-white">{editorPrice.toLocaleString()} UZS</p>
                    </div>
                    <div className="rounded-xl border border-light-border bg-white p-3 dark:border-navy-700 dark:bg-navy-800">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5a6d7c]">{t('stock')}</p>
                      <p className="mt-1 text-lg font-bold text-[#1f2933] dark:text-white">{editorStock}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-light-border bg-white p-3 dark:border-navy-700 dark:bg-navy-800">
                    <div className="flex flex-wrap items-center gap-2">
                      {availabilityBadge(editorStatus)}
                      {!formState.is_active && (
                        <Badge variant="default">{tr('Inactive', 'Неактивный', 'Nofaol')}</Badge>
                      )}
                      {formState.requires_returnable_bottle && (
                        <Badge variant="info">{tr('Returnable bottle', 'Возвратная тара', 'Qaytariladigan idish')}</Badge>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-400">{tr('Size', 'Размер', 'Hajm')}</p>
                        <p className="mt-0.5 font-semibold text-gray-800 dark:text-white">{formState.size_liters || '-'}L</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">{tr('Min threshold', 'Мин. порог', 'Min. chegara')}</p>
                        <p className="mt-0.5 font-semibold text-gray-800 dark:text-white">{editorMinThreshold}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">{tr('Bottle deposit', 'Депозит', 'Depozit')}</p>
                        <p className="mt-0.5 font-semibold text-gray-800 dark:text-white">
                          {formState.requires_returnable_bottle
                            ? `${editorDeposit.toLocaleString()} UZS`
                            : tr('N/A', 'Нет', "Yo'q")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">{tr('Photos', 'Фото', 'Rasmlar')}</p>
                        <p className="mt-0.5 font-semibold text-gray-800 dark:text-white">{editorMediaCount}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="flex justify-end gap-3 border-t border-light-border pt-4 dark:border-navy-700">
            <button
              type="button"
              onClick={closeEditor}
              className="rounded-lg px-3 py-1.5 text-xs text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-navy-700"
            >
              {t('cancel')}
            </button>
            <button
              disabled={saving}
              type="submit"
              className="rounded-lg bg-primary-blue px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? tr('Saving…', 'Сохранение…', 'Saqlanmoqda…') : t('save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════ DETAIL MODAL ══════════════════ */}
      <Modal
        isOpen={Boolean(detailProduct)}
        onClose={closeDetail}
        title={detailProduct?.name ?? tr('Product detail', 'Детали товара', 'Mahsulot tafsiloti')}
        footer={null}
        maxWidthClass="max-w-5xl"
      >
        {detailProduct && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">

              {/* image viewer */}
              <div className="space-y-3">
                <div
                  className="relative w-full overflow-hidden rounded-[24px] bg-gradient-to-br from-[#21404d] via-[#3d6c77] to-[#d9a25f] shadow-[0_20px_40px_rgba(33,64,77,0.16)]"
                  style={{ aspectRatio: '4/3' }}
                >
                  {detailMedia.length > 0 ? (
                    <img
                      key={detailMedia[detailIndex]?.url}
                      src={detailMedia[detailIndex]?.url}
                      alt={`${detailProduct.name} ${detailIndex + 1}`}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-white/60">
                        <Package size={36} className="mx-auto" />
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em]">
                          {tr('No photo', 'Нет фото', "Rasm yo'q")}
                        </p>
                      </div>
                    </div>
                  )}

                  {detailMedia.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => shiftDetail(-1)}
                        className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftDetail(1)}
                        className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </>
                  )}

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-4 pt-10">
                    <p className="text-[14px] font-semibold text-white">{detailProduct.name}</p>
                    <p className="mt-0.5 text-xs text-white/55">
                      {detailProduct.size_liters}L · {detailMedia.length} {tr('photos', 'фото', 'rasm')}
                      {detailMedia.length > 1 && ` · ${detailIndex + 1}/${detailMedia.length}`}
                    </p>
                  </div>
                </div>

                {detailMedia.length > 1 && (
                  <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                    {detailMedia.map((img, i) => (
                      <GalleryThumb
                        key={img.id}
                        image={img}
                        isActive={i === detailIndex}
                        altText={`${detailProduct.name} ${i + 1}`}
                        onClick={() => setDetailIndex(i)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* detail info */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[linear-gradient(135deg,rgba(255,247,237,0.96)_0%,rgba(255,255,255,1)_100%)] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9a6b3a]">SKU</p>
                    <p className="mt-1 text-sm font-semibold text-[#1f2933]">{detailProduct.sku || '-'}</p>
                  </div>
                  <div className="rounded-xl bg-[linear-gradient(135deg,rgba(236,242,255,0.96)_0%,rgba(255,255,255,1)_100%)] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#355cbb]">
                      {tr('Updated', 'Обновлено', 'Yangilangan')}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#1f2933]">{fmtDate(detailProduct.updated_at)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-light-border bg-white p-3 dark:border-navy-700 dark:bg-navy-800">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#40635b]">{t('price')}</p>
                    <p className="mt-1 text-xl font-bold text-[#1f2933] dark:text-white">
                      {detailProduct.price_uzs.toLocaleString()} UZS
                    </p>
                  </div>
                  <div className="rounded-xl border border-light-border bg-white p-3 dark:border-navy-700 dark:bg-navy-800">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5a6d7c]">{t('stock')}</p>
                    <p className="mt-1 text-xl font-bold text-[#1f2933] dark:text-white">{detailProduct.count}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-light-border bg-white p-4 dark:border-navy-700 dark:bg-navy-800 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {availabilityBadge(detailProduct.availability_status)}
                    {!detailProduct.is_active && (
                      <Badge variant="default">{tr('Inactive', 'Неактивный', 'Nofaol')}</Badge>
                    )}
                    {detailProduct.requires_returnable_bottle && (
                      <Badge variant="info">{tr('Returnable bottle', 'Возвратная тара', 'Qaytariladigan idish')}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">{tr('Size', 'Размер', 'Hajm')}</p>
                      <p className="mt-0.5 font-semibold text-gray-800 dark:text-white">{detailProduct.size_liters || '-'}L</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">{tr('Min threshold', 'Мин. порог', 'Min. chegara')}</p>
                      <p className="mt-0.5 font-semibold text-gray-800 dark:text-white">{detailProduct.min_stock_threshold}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">{tr('Bottle deposit', 'Депозит', 'Depozit')}</p>
                      <p className="mt-0.5 font-semibold text-gray-800 dark:text-white">
                        {detailProduct.requires_returnable_bottle
                          ? `${detailProduct.bottle_deposit_uzs.toLocaleString()} UZS`
                          : tr('N/A', 'Нет', "Yo'q")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">{tr('Photos', 'Фото', 'Rasmlar')}</p>
                      <p className="mt-0.5 font-semibold text-gray-800 dark:text-white">{detailMedia.length}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-light-border bg-[rgba(248,252,251,0.88)] px-4 py-3 text-xs text-[#4b5663] dark:border-navy-700 dark:bg-navy-900/40 dark:text-gray-400">
                  {tr(
                    'Quick review only. Use Edit to change stock, price, bottle rules, or images.',
                    'Только быстрый просмотр. Используйте редактирование для изменений.',
                    "Tez ko'rish uchun. O'zgartirish uchun tahrirlashdan foydalaning."
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { closeDetail(); openEdit(detailProduct); }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#21404d] px-3 py-2 text-xs font-medium text-white transition hover:brightness-110"
                  >
                    <Edit2 size={12} /> {tr('Edit this product', 'Редактировать товар', 'Mahsulotni tahrirlash')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Products;
