import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Edit2,
  GripVertical,
  History,
  Images,
  Package,
  Plus,
  RefreshCw,
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
import { useActionConfirm } from '../components/ui/useActionConfirm';
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

interface ApiProductMovement {
  id: string;
  product_id: string;
  product_name: string;
  product_sku?: string | null;
  product_size_liters?: string | null;
  movement_type: string;
  direction: 'income' | 'outcome' | 'neutral' | string;
  delta: number;
  absolute_quantity: number;
  before_count?: number | null;
  after_count?: number | null;
  actor?: string | null;
  actor_user_id?: string | null;
  actor_user_name?: string | null;
  actor_client_id?: string | null;
  actor_client_name?: string | null;
  related_order_id?: string | null;
  related_order_short_id?: string | null;
  related_order_status?: string | null;
  related_order_source?: string | null;
  related_client_id?: string | null;
  related_client_name?: string | null;
  is_order_related?: boolean;
  reason?: string | null;
  source?: string | null;
  reference?: string | null;
  note?: string | null;
  created_at: string;
}

interface ProductListResponse {
  results?: ApiProduct[];
  stock_summary?: {
    total_products?: number;
    active_products?: number;
    out_of_stock?: number;
  };
}

interface ProductMovementsSummary {
  total_movements?: number;
  incoming_movements_count?: number;
  outgoing_movements_count?: number;
  neutral_movements_count?: number;
  total_incoming_quantity?: number;
  total_outgoing_quantity?: number;
  net_quantity_delta?: number;
}

interface ProductMovementsResponse {
  summary?: ProductMovementsSummary;
  count?: number;
  total?: number;
  limit?: number;
  offset?: number;
  results?: ApiProductMovement[];
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

type ProductsTab = 'catalog' | 'movements';

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
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const toast = useToast();
  const { confirm, confirmationModal } = useActionConfirm();
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
  const [activeTab, setActiveTab] = useState<ProductsTab>('catalog');
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementSummary, setMovementSummary] = useState<ProductMovementsSummary | null>(null);
  const [movementRows, setMovementRows] = useState<ApiProductMovement[]>([]);
  const [movementCount, setMovementCount] = useState(0);
  const [movementTotal, setMovementTotal] = useState(0);
  const [movementsLoaded, setMovementsLoaded] = useState(false);
  const [movementFilters, setMovementFilters] = useState({
    q: '',
    product_id: '',
    actor_user_id: '',
    client_id: '',
    order_id: '',
    movement_type: '',
    direction: '',
    date_from: '',
    date_to: '',
    limit: '100',
    offset: '0',
  });

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

  const loadProductMovements = useCallback(async (nextFilters = movementFilters) => {
    try {
      setMovementLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (nextFilters.q.trim()) params.set('q', nextFilters.q.trim());
      if (nextFilters.product_id) params.set('product_id', nextFilters.product_id);
      if (nextFilters.actor_user_id.trim()) params.set('actor_user_id', nextFilters.actor_user_id.trim());
      if (nextFilters.client_id.trim()) params.set('client_id', nextFilters.client_id.trim());
      if (nextFilters.order_id.trim()) params.set('order_id', nextFilters.order_id.trim());
      if (nextFilters.movement_type.trim()) params.set('movement_type', nextFilters.movement_type.trim());
      if (nextFilters.direction) params.set('direction', nextFilters.direction);
      if (nextFilters.date_from) params.set('date_from', nextFilters.date_from);
      if (nextFilters.date_to) params.set('date_to', nextFilters.date_to);
      if (nextFilters.limit) params.set('limit', nextFilters.limit);
      if (nextFilters.offset) params.set('offset', nextFilters.offset);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiRequest<ProductMovementsResponse>(`${ENDPOINTS.PRODUCTS.MOVEMENTS}${query}`);
      setMovementSummary(res.summary ?? null);
      setMovementRows(res.results ?? []);
      setMovementCount(res.count ?? (res.results ?? []).length);
      setMovementTotal(res.total ?? res.summary?.total_movements ?? (res.results ?? []).length);
      setMovementsLoaded(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : tr('Failed to load product movements', 'Не удалось загрузить движения товара', 'Mahsulot harakatlarini yuklab bo‘lmadi');
      setError(msg);
      toast.error(msg);
    } finally {
      setMovementLoading(false);
    }
  }, [movementFilters, toast, tr]);

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

  useEffect(() => {
    if (activeTab !== 'movements') return;
    if (!movementsLoaded) {
      void loadProductMovements();
    }
  }, [activeTab, loadProductMovements, movementsLoaded]);

  const productStats = useMemo(() => ({
    totalProducts: stockSummary?.total_products ?? products.length,
    activeProducts: stockSummary?.active_products ?? products.filter((p) => p.is_active !== false).length,
    outOfStock: stockSummary?.out_of_stock ?? products.filter((p) => p.availability_status === 'out_of_stock').length,
  }), [products, stockSummary]);

  const movementStats = useMemo(() => ({
    totalMovements: movementSummary?.total_movements ?? movementTotal ?? movementCount,
    incomingCount: movementSummary?.incoming_movements_count ?? 0,
    outgoingCount: movementSummary?.outgoing_movements_count ?? 0,
    neutralCount: movementSummary?.neutral_movements_count ?? 0,
    incomingQuantity: movementSummary?.total_incoming_quantity ?? 0,
    outgoingQuantity: movementSummary?.total_outgoing_quantity ?? 0,
    netQuantity: movementSummary?.net_quantity_delta ?? 0,
  }), [movementCount, movementSummary, movementTotal]);

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

  const fmtQty = (value?: number | null) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '-';
    return new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-UZ' : 'en-US', {
      maximumFractionDigits: 2,
    }).format(value);
  };

  const movementDirectionBadge = (direction?: string | null) => {
    if (direction === 'income') {
      return <Badge variant="success">{tr('Income', 'Приход', 'Kirim')}</Badge>;
    }
    if (direction === 'outcome') {
      return <Badge variant="warning">{tr('Outcome', 'Расход', 'Chiqim')}</Badge>;
    }
    return <Badge variant="default">{tr('Neutral', 'Нейтрально', 'Neytral')}</Badge>;
  };

  const humanizeBackendCode = (value?: string | null) => {
    if (!value) return '-';
    return value
      .split('_')
      .join(' ')
      .toLowerCase()
      .replace(/^\w/, (char) => char.toUpperCase());
  };

  const getOrderSourceLabel = (value?: string | null) => {
    if (value === 'MANUAL_OFFLINE') {
      return tr('Recorded sale', 'Зафиксированная продажа', 'Qayd etilgan savdo');
    }
    if (value === 'LIVE') {
      return tr('Live order', 'Живой заказ', 'Jonli buyurtma');
    }
    return humanizeBackendCode(value);
  };

  const getOrderStatusLabel = (value?: string | null) => {
    switch (value) {
      case 'NEW_LEAD':
        return tr('New lead', 'Новый лид', 'Yangi so‘rov');
      case 'INFO_COLLECTED':
        return tr('Info collected', 'Данные собраны', "Ma'lumot yig'ilgan");
      case 'PAYMENT_PENDING':
        return tr('Payment pending', 'Ожидает оплаты', "To'lov kutilmoqda");
      case 'PAYMENT_CONFIRMED':
        return tr('Payment confirmed', 'Оплата подтверждена', "To'lov tasdiqlangan");
      case 'DISPATCHED':
        return tr('Sent to couriers', 'Отправлен курьерам', 'Kuryerlarga yuborilgan');
      case 'ASSIGNED':
        return tr('Taken by courier', 'Назначен курьеру', 'Kuryer olgan');
      case 'OUT_FOR_DELIVERY':
        return tr('On the way', 'В пути', 'Yo‘lda');
      case 'DELIVERED':
        return tr('Delivered', 'Доставлен', 'Yetkazildi');
      case 'CANCELED':
        return tr('Canceled', 'Отменён', 'Bekor qilingan');
      case 'FAILED':
        return tr('Failed', 'Не выполнен', 'Bajarilmagan');
      default:
        return humanizeBackendCode(value);
    }
  };

  const getMovementTypeLabel = (value?: string | null) => {
    switch (value) {
      case 'ORDER_RESERVE':
        return tr('Reserved for order', 'Зарезервировано для заказа', 'Buyurtma uchun ajratildi');
      case 'ORDER_RELEASE':
        return tr('Returned from reserve', 'Возвращено из резерва', 'Zaxiradan qaytarildi');
      case 'SET':
        return tr('Stock set manually', 'Остаток установлен вручную', 'Qoldiq qo‘lda o‘rnatildi');
      case 'ADJUST':
        return tr('Stock adjusted', 'Остаток скорректирован', 'Qoldiq tuzatildi');
      case 'ORDER_DELIVERED':
        return tr('Order delivered', 'Заказ доставлен', 'Buyurtma yetkazildi');
      default:
        return humanizeBackendCode(value);
    }
  };

  const getMovementReasonLabel = (value?: string | null) => {
    switch (value) {
      case 'Reserved stock for order item upsert':
        return tr(
          'Stock was reserved for the order',
          'Товар зарезервирован для заказа',
          'Mahsulot buyurtma uchun zaxiraga olindi'
        );
      case 'Customer canceled draft from bot flow':
        return tr(
          'The customer canceled the draft order, stock returned',
          'Клиент отменил черновик заказа, остаток возвращён',
          'Mijoz qoralama buyurtmani bekor qildi, mahsulot qoldiqqa qaytdi'
        );
      case 'Admin correction':
        return tr('Admin correction', 'Корректировка администратора', 'Operator tuzatishi');
      default:
        return value || '';
    }
  };

  const getSystemLabel = (value?: string | null) => {
    if (!value) return '-';
    if (value === 'system') return tr('System', 'Система', 'Tizim');
    if (value === 'admin_api' || value === 'frontend-ui') {
      return tr('Admin dashboard', 'Админ-панель', 'Boshqaruv paneli');
    }
    if (value === 'product_api' || value === 'product_api_patch') {
      return tr('Product management', 'Управление товарами', 'Mahsulot boshqaruvi');
    }
    if (value === 'order_workflow') {
      return tr('Order workflow', 'Логика заказа', 'Buyurtma jarayoni');
    }
    if (value.startsWith('telegram:')) {
      return tr('Telegram client', 'Telegram клиент', 'Telegram mijozi');
    }
    if (value.startsWith('pending:telegram')) {
      return tr('Unverified Telegram user', 'Неподтверждённый Telegram', 'Tasdiqlanmagan Telegram foydalanuvchisi');
    }
    return value;
  };

  const openMovementOrder = (movement: ApiProductMovement) => {
    if (!movement.related_order_id) return;
    navigate(`/admin-app/orders?order_id=${movement.related_order_id}`);
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); void loadProducts(); };
  const handleMovementSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void loadProductMovements();
  };

  const resetMovementFilters = () => {
    const nextFilters = {
      q: '',
      product_id: '',
      actor_user_id: '',
      client_id: '',
      order_id: '',
      movement_type: '',
      direction: '',
      date_from: '',
      date_to: '',
      limit: '100',
      offset: '0',
    };
    setMovementFilters(nextFilters);
    void loadProductMovements(nextFilters);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (editing) {
      const confirmed = await confirm({
        title: tr('Save product changes', 'Сохранить изменения товара', "Mahsulot o'zgarishlarini saqlash"),
        message: tr(
          `Save changes for "${editing.name}"?`,
          `Сохранить изменения для "${editing.name}"?`,
          `"${editing.name}" uchun o'zgarishlarni saqlaysizmi?`
        ),
        confirmLabel: tr('Save changes', 'Сохранить изменения', "O'zgarishlarni saqlash"),
        cancelLabel: t('cancel'),
        tone: 'primary',
      });
      if (!confirmed) return;
    }

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
    const confirmed = await confirm({
      title: tr('Deactivate product', 'Деактивировать товар', 'Mahsulotni nofaol qilish'),
      message: tr(
        `Deactivate "${product.name}"?`,
        `Деактивировать "${product.name}"?`,
        `"${product.name}" mahsulotini nofaol qilasizmi?`
      ),
      confirmLabel: tr('Deactivate', 'Деактивировать', 'Nofaol qilish'),
      cancelLabel: t('cancel'),
      tone: 'danger',
    });
    if (!confirmed) return;
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
            {activeTab === 'catalog'
              ? tr(
                  'Manage products, stock, and photos in one clean workspace.',
                  'Управляйте товарами, остатками и фото в одном удобном месте.',
                  "Mahsulotlar, qoldiq va rasmlarni bitta toza oynada boshqaring."
                )
              : tr(
                  'Track stock income and outcome history, see who changed inventory, and jump into linked orders when needed.',
                  'Следите за приходом и расходом склада, смотрите кто изменил остатки и переходите в связанный заказ при необходимости.',
                  "Ombordagi kirim-chiqim tarixini kuzating, zaxirani kim o'zgartirganini ko'ring va kerak bo'lsa bog'langan buyurtmaga o'ting."
                )}
          </p>
        </div>
        {activeTab === 'catalog' ? (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-blue px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600"
          >
            <Plus size={16} /> {t('create')}
          </button>
        ) : (
          <button
            onClick={() => void loadProductMovements()}
            className="inline-flex items-center gap-2 rounded-xl border border-light-border bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-navy-700 dark:bg-navy-800 dark:text-gray-200 dark:hover:bg-navy-700"
          >
            <RefreshCw size={16} className={movementLoading ? 'animate-spin' : ''} />
            {tr('Refresh movements', 'Обновить движения', 'Harakatlarni yangilash')}
          </button>
        )}
      </div>

      <div className="inline-flex rounded-2xl border border-light-border bg-white p-1 shadow-sm dark:border-navy-700 dark:bg-navy-800">
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
            activeTab === 'catalog'
              ? 'bg-primary-blue text-white'
              : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-navy-700'
          }`}
        >
          <Package size={16} />
          {tr('Catalog', 'Каталог', 'Katalog')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('movements')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
            activeTab === 'movements'
              ? 'bg-primary-blue text-white'
              : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-navy-700'
          }`}
        >
          <History size={16} />
          {tr('Product movements', 'Движения товара', 'Mahsulot harakatlari')}
        </button>
      </div>

      {activeTab === 'catalog' ? (
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
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: tr('Total movements', 'Всего движений', 'Jami harakatlar'), value: movementStats.totalMovements, color: '#21404d', bg: 'rgba(236,242,255,0.94)' },
            { label: tr('Incoming quantity', 'Приход', 'Kirim miqdori'), value: fmtQty(movementStats.incomingQuantity), color: '#40635b', bg: 'rgba(232,241,238,0.94)' },
            { label: tr('Outgoing quantity', 'Расход', 'Chiqim miqdori'), value: fmtQty(movementStats.outgoingQuantity), color: '#c7762c', bg: 'rgba(255,247,237,0.94)' },
            {
              label: tr('Net delta', 'Чистое изменение', 'Net o`zgarish'),
              value: `${movementStats.netQuantity > 0 ? '+' : ''}${fmtQty(movementStats.netQuantity)}`,
              color: movementStats.netQuantity >= 0 ? '#355cbb' : '#b24b45',
              bg: movementStats.netQuantity >= 0 ? 'rgba(236,242,255,0.94)' : 'rgba(255,241,241,0.94)',
            },
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
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {activeTab === 'catalog' ? (
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
      ) : (
        <div className="space-y-4">
          <Card accent="blue">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                  <History size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    {tr('Product movement audit', 'Аудит движения товара', 'Mahsulot harakatlari auditi')}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {tr(
                      'Use this tab to review stock income and outcome. Order-linked movements can open the related order directly from the table.',
                      'Используйте эту вкладку для просмотра приходов и расходов склада. Движения, связанные с заказом, можно открыть прямо из таблицы.',
                      "Bu tab orqali ombordagi kirim va chiqimlarni ko'ring. Buyurtmaga bog'langan harakatlardan jadvalning o'zidan buyurtmaga o'tish mumkin."
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">{tr('Income rows', 'Приход', 'Kirim')}: {movementStats.incomingCount}</Badge>
                <Badge variant="warning">{tr('Outcome rows', 'Расход', 'Chiqim')}: {movementStats.outgoingCount}</Badge>
                <Badge variant="default">{tr('Neutral rows', 'Нейтральные', 'Neytral')}: {movementStats.neutralCount}</Badge>
                <Badge variant="info">{tr('Showing', 'Показано', "Ko'rsatilgan")}: {movementCount}/{movementTotal || movementCount}</Badge>
              </div>

              <form onSubmit={handleMovementSearch} className="grid grid-cols-1 gap-4 xl:grid-cols-6">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    {tr('Search', 'Поиск', 'Qidiruv')}
                  </label>
                  <input
                    value={movementFilters.q}
                    onChange={(e) => setMovementFilters((prev) => ({ ...prev, q: e.target.value }))}
                    placeholder={tr('Product, SKU, order, actor…', 'Товар, SKU, заказ, актор…', 'Mahsulot, SKU, buyurtma, aktor…')}
                    className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    {tr('Product', 'Товар', 'Mahsulot')}
                  </label>
                  <select
                    value={movementFilters.product_id}
                    onChange={(e) => setMovementFilters((prev) => ({ ...prev, product_id: e.target.value }))}
                    className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                  >
                    <option value="">{tr('All products', 'Все товары', 'Barcha mahsulotlar')}</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {product.size_liters}L
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    {tr('Direction', 'Направление', "Yo'nalish")}
                  </label>
                  <select
                    value={movementFilters.direction}
                    onChange={(e) => setMovementFilters((prev) => ({ ...prev, direction: e.target.value }))}
                    className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                  >
                    <option value="">{tr('All directions', 'Все направления', "Barcha yo'nalishlar")}</option>
                    <option value="income">{tr('Income', 'Приход', 'Kirim')}</option>
                    <option value="outcome">{tr('Outcome', 'Расход', 'Chiqim')}</option>
                    <option value="neutral">{tr('Neutral', 'Нейтрально', 'Neytral')}</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    {tr('Movement type', 'Тип движения', 'Harakat turi')}
                  </label>
                  <input
                    value={movementFilters.movement_type}
                    onChange={(e) => setMovementFilters((prev) => ({ ...prev, movement_type: e.target.value }))}
                    placeholder={tr('e.g. reserve or release', 'например reserve или release', 'masalan zaxira yoki qaytarish')}
                    className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    {tr('Actor user ID', 'ID пользователя', 'Aktor foydalanuvchi ID')}
                  </label>
                  <input
                    value={movementFilters.actor_user_id}
                    onChange={(e) => setMovementFilters((prev) => ({ ...prev, actor_user_id: e.target.value }))}
                    placeholder={tr('Filter by user UUID', 'Фильтр по UUID пользователя', 'Foydalanuvchi UUID bo‘yicha')}
                    className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    {tr('Limit', 'Лимит', 'Limit')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                    value={movementFilters.limit}
                    onChange={(e) => setMovementFilters((prev) => ({ ...prev, limit: e.target.value }))}
                    className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                    >
                      {['20', '50', '100', '200'].map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                    <input
                      value={movementFilters.offset}
                      onChange={(e) => setMovementFilters((prev) => ({ ...prev, offset: e.target.value }))}
                      placeholder={tr('Offset', 'Сдвиг', 'Offset')}
                      className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    {tr('Client ID', 'ID клиента', 'Mijoz ID')}
                  </label>
                  <input
                    value={movementFilters.client_id}
                    onChange={(e) => setMovementFilters((prev) => ({ ...prev, client_id: e.target.value }))}
                    placeholder={tr('Related client UUID', 'UUID клиента', 'Mijoz UUID')}
                    className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    {tr('Order ID', 'ID заказа', 'Buyurtma ID')}
                  </label>
                  <input
                    value={movementFilters.order_id}
                    onChange={(e) => setMovementFilters((prev) => ({ ...prev, order_id: e.target.value }))}
                    placeholder={tr('Related order UUID', 'UUID заказа', 'Buyurtma UUID')}
                    className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    {tr('From date', 'Дата от', 'Boshlanish sanasi')}
                  </label>
                  <input
                    type="date"
                    value={movementFilters.date_from}
                    onChange={(e) => setMovementFilters((prev) => ({ ...prev, date_from: e.target.value }))}
                    className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    {tr('To date', 'Дата до', 'Tugash sanasi')}
                  </label>
                  <input
                    type="date"
                    value={movementFilters.date_to}
                    onChange={(e) => setMovementFilters((prev) => ({ ...prev, date_to: e.target.value }))}
                    className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                  />
                </div>

                <div className="xl:col-span-2 flex flex-wrap items-end justify-end gap-3">
                  <button
                    type="button"
                    onClick={resetMovementFilters}
                    className="inline-flex items-center gap-2 rounded-xl border border-light-border bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-navy-700 dark:bg-navy-800 dark:text-gray-200 dark:hover:bg-navy-700"
                  >
                    <RotateCcw size={15} />
                    {tr('Reset filters', 'Сбросить фильтры', 'Filtrlarni tozalash')}
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary-blue px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600"
                  >
                    <Search size={15} />
                    {tr('Apply filters', 'Применить фильтры', 'Filtrlarni qo‘llash')}
                  </button>
                </div>
              </form>
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden">
            <div className="border-b border-light-border bg-white px-4 py-4 dark:border-navy-700 dark:bg-navy-800">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {tr('Product movement history', 'История движения товара', 'Mahsulot harakatlari tarixi')}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {tr(
                  'This view is powered by GET /internal/products/movements/ and is designed for stock income, reserve, sale, and restoration history.',
                  'Этот экран использует GET /internal/products/movements/ и предназначен для истории приходов, резервов, продаж и возвратов склада.',
                  "Ushbu ko'rinish GET /internal/products/movements/ endpointi bilan ishlaydi va kirim, rezerv, sotuv hamda qayta tiklash tarixini ko'rsatadi."
                )}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-light-border text-sm dark:divide-navy-700">
                <thead className="bg-gray-50 dark:bg-navy-900/60">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                    <th className="px-4 py-3">{tr('Created', 'Создано', 'Yaratilgan')}</th>
                    <th className="px-4 py-3">{tr('Product', 'Товар', 'Mahsulot')}</th>
                    <th className="px-4 py-3">{tr('Direction', 'Направление', "Yo'nalish")}</th>
                    <th className="px-4 py-3 text-right">{tr('Quantity', 'Количество', 'Miqdor')}</th>
                    <th className="px-4 py-3">{tr('Before / after', 'До / после', 'Oldin / keyin')}</th>
                    <th className="px-4 py-3">{tr('Movement type', 'Тип движения', 'Harakat turi')}</th>
                    <th className="px-4 py-3">{tr('Who did it', 'Кто сделал', 'Kim bajardi')}</th>
                    <th className="px-4 py-3">{tr('Related client / order', 'Клиент / заказ', 'Bog‘liq mijoz / buyurtma')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border dark:divide-navy-700">
                  {movementLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                        {tr('Loading product movements…', 'Загрузка движений товара…', 'Mahsulot harakatlari yuklanmoqda…')}
                      </td>
                    </tr>
                  ) : movementRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                        {tr('No product movements found for the current filters.', 'По текущим фильтрам движения товара не найдены.', 'Joriy filtrlar uchun mahsulot harakatlari topilmadi.')}
                      </td>
                    </tr>
                  ) : (
                    movementRows.map((movement) => {
                      const rowClickable = Boolean(movement.related_order_id);
                      const actorLabel = movement.actor_user_name || getSystemLabel(movement.actor);
                      const actorMetaLabel = getSystemLabel(movement.source || movement.actor);
                      const relatedLabel =
                        movement.related_client_name ||
                        getSystemLabel(movement.actor_client_name) ||
                        '-';

                      return (
                        <tr
                          key={movement.id}
                          onClick={rowClickable ? () => openMovementOrder(movement) : undefined}
                          className={`align-top ${rowClickable ? 'cursor-pointer hover:bg-blue-50/60 dark:hover:bg-navy-800/80' : 'hover:bg-gray-50/70 dark:hover:bg-navy-800/60'}`}
                        >
                          <td className="px-4 py-4 text-gray-600 dark:text-gray-300">
                            {fmtDate(movement.created_at)}
                          </td>
                          <td className="px-4 py-4">
                            <div className="min-w-[220px]">
                              <p className="font-semibold text-gray-900 dark:text-white">{movement.product_name}</p>
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {movement.product_sku || '-'} · {movement.product_size_liters || '-'}L
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="min-w-[140px] space-y-2">
                              {movementDirectionBadge(movement.direction)}
                              {movement.related_order_source ? (
                                <Badge variant={movement.related_order_source === 'MANUAL_OFFLINE' ? 'default' : 'info'}>
                                  {getOrderSourceLabel(movement.related_order_source)}
                                </Badge>
                              ) : null}
                            </div>
                          </td>
                          <td className={`px-4 py-4 text-right font-semibold ${movement.direction === 'income' ? 'text-emerald-600 dark:text-emerald-400' : movement.direction === 'outcome' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                            {movement.delta > 0 ? '+' : ''}{fmtQty(movement.delta)}
                            <p className="mt-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                              {tr('Quantity', 'Количество', 'Miqdor')} {fmtQty(movement.absolute_quantity)}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">
                            <div className="min-w-[150px]">
                              <p>{tr('Before', 'До', 'Oldin')}: <span className="font-medium text-gray-800 dark:text-white">{fmtQty(movement.before_count ?? 0)}</span></p>
                              <p className="mt-1">{tr('After', 'После', 'Keyin')}: <span className="font-medium text-gray-800 dark:text-white">{fmtQty(movement.after_count ?? 0)}</span></p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="min-w-[220px]">
                              <Badge variant="default">{getMovementTypeLabel(movement.movement_type)}</Badge>
                              {getMovementReasonLabel(movement.reason) ? (
                                <p className="mt-2 max-w-[220px] text-xs text-gray-500 dark:text-gray-400">{getMovementReasonLabel(movement.reason)}</p>
                              ) : null}
                              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                                {getSystemLabel(movement.source)}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">
                            <div className="min-w-[180px]">
                              <p className="font-medium text-gray-800 dark:text-white">
                                {movement.direction === 'income' ? actorLabel : actorLabel}
                              </p>
                              <p className="mt-1">{actorMetaLabel}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">
                            <div className="min-w-[220px]">
                              <p className="font-medium text-gray-800 dark:text-white">{relatedLabel}</p>
                              {movement.related_order_id ? (
                                <div className="mt-2 inline-flex flex-wrap items-center gap-2">
                                  <Badge variant="info">
                                    #{movement.related_order_short_id || movement.related_order_id.slice(0, 8)}
                                  </Badge>
                                  {movement.related_order_status ? (
                                    <Badge variant="default">{getOrderStatusLabel(movement.related_order_status)}</Badge>
                                  ) : null}
                                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                                    {tr('Open order', 'Открыть заказ', 'Buyurtmani ochish')}
                                  </span>
                                </div>
                              ) : (
                                <p className="mt-1 text-gray-400 dark:text-gray-500">-</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

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
              className="rounded-lg px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-navy-700"
            >
              {t('cancel')}
            </button>
            <button
              disabled={saving}
              type="submit"
              className="rounded-lg bg-primary-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
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
                    className="inline-flex items-center gap-2 rounded-xl bg-[#21404d] px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110"
                  >
                    <Edit2 size={14} /> {tr('Edit this product', 'Редактировать товар', 'Mahsulotni tahrirlash')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
      {confirmationModal}
    </div>
  );
};

export default Products;
