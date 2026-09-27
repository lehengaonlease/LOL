import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  ArrowLeft,
  Film,
  Image as ImageIcon,
  Palette,
  ShoppingBag,
  ExternalLink,
  Save,
  X,
  Eye,
  ArrowUpDown,
  Sparkles,
  Ruler,
  ShieldCheck,
  Clock,
  Play,
  ZoomIn,
  ZoomOut,
  ChevronRight,
  Search,
} from 'lucide-react';
import { LehengaOutfit, SiteSettings, DEFAULT_SITE_SETTINGS } from '../types';
import { LolBrandLogo } from './LolBrandLogo';

interface AdminDashboardProps {
  outfits: LehengaOutfit[];
  siteSettings: SiteSettings;
  onUpdateSiteSettings: (settings: SiteSettings) => Promise<void> | void;
  onAddOutfit: (outfit: LehengaOutfit) => Promise<void> | void;
  onUpdateOutfit: (outfit: LehengaOutfit) => Promise<void> | void;
  onDeleteOutfit: (id: string) => Promise<void> | void;
  onResetCatalog: () => void;
  onBackToCatalog: () => void;
}

// Helper to upload a file to /uploads on backend
async function uploadFileToBackend(file: File, prefix: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to read file'));
        return;
      }
      try {
        if (prefix === 'hero-banner-video') {
          const res = await fetch('/api/banner-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoDataUrl: reader.result }),
          });
          if (res.ok) {
            const data = await res.json();
            resolve(data.url);
            return;
          }
        } else {
          const res = await fetch('/api/upload-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl: reader.result, prefix }),
          });
          if (res.ok) {
            const data = await res.json();
            resolve(data.url);
            return;
          }
        }
        resolve(reader.result);
      } catch {
        resolve(reader.result);
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

interface EditableGridCardProps {
  outfit: LehengaOutfit;
  onSaveOutfit: (updated: LehengaOutfit, msg?: string) => Promise<void>;
  onDeleteOutfit: (id: string) => Promise<void> | void;
  onOpenDetailEditor: (outfit: LehengaOutfit) => void;
}

const EditableGridCard: React.FC<EditableGridCardProps> = ({
  outfit,
  onSaveOutfit,
  onDeleteOutfit,
  onOpenDetailEditor,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);
  const photoFileInputRefs = [
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
  ];
  const batchPhotosInputRef = useRef<HTMLInputElement | null>(null);

  const [code, setCode] = useState(outfit.code);
  const [title, setTitle] = useState(outfit.title);
  const [vibeCategory, setVibeCategory] = useState(outfit.vibeCategory);
  const [description, setDescription] = useState(outfit.description);
  const [pricePerDay, setPricePerDay] = useState(String(outfit.pricePerDay));
  const [sizesText, setSizesText] = useState(outfit.sizes.join(', '));
  const [available, setAvailable] = useState(outfit.available);
  const [videoUrl, setVideoUrl] = useState(
    outfit.videoUrl || (outfit.mediaType === 'video' ? outfit.mediaUrl : '')
  );
  const [imageSlots, setImageSlots] = useState<[string, string, string, string]>(() => {
    const imgs =
      Array.isArray(outfit.images) && outfit.images.length > 0
        ? outfit.images
        : outfit.mediaType === 'image' && outfit.mediaUrl
        ? [outfit.mediaUrl]
        : [];
    return [imgs[0] || '', imgs[1] || '', imgs[2] || '', imgs[3] || ''];
  });

  const [showMediaTray, setShowMediaTray] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync local state when outfit prop updates from parent
  useEffect(() => {
    setCode(outfit.code);
    setTitle(outfit.title);
    setVibeCategory(outfit.vibeCategory);
    setDescription(outfit.description);
    setPricePerDay(String(outfit.pricePerDay));
    setSizesText(outfit.sizes.join(', '));
    setAvailable(outfit.available);
    setVideoUrl(outfit.videoUrl || (outfit.mediaType === 'video' ? outfit.mediaUrl : ''));
    const imgs =
      Array.isArray(outfit.images) && outfit.images.length > 0
        ? outfit.images
        : outfit.mediaType === 'image' && outfit.mediaUrl
        ? [outfit.mediaUrl]
        : [];
    setImageSlots([imgs[0] || '', imgs[1] || '', imgs[2] || '', imgs[3] || '']);
  }, [outfit]);

  // Build front-end identical media items (Video is index 0 when present; otherwise Photo 1 is index 0)
  const mediaItems = useMemo(() => {
    const items: { type: 'image' | 'video'; url: string; label: string }[] = [];
    const cleanVid = videoUrl.trim();
    if (cleanVid) {
      items.push({
        type: 'video',
        url: cleanVid,
        label: 'Video',
      });
    }
    const validImgs = imageSlots.map((s) => s.trim()).filter(Boolean);
    validImgs.forEach((url, idx) => {
      items.push({
        type: 'image',
        url,
        label: `Photo ${idx + 1}`,
      });
    });

    if (items.length === 0) {
      const fallbackPhoto =
        (outfit.mediaType === 'image' && outfit.mediaUrl ? outfit.mediaUrl : '') ||
        '/images/lehenga-orange-zardosi.jpg';
      items.push({
        type: 'image',
        url: fallbackPhoto,
        label: 'Photo 1',
      });
    }
    return items;
  }, [videoUrl, imageSlots, outfit.mediaType, outfit.mediaUrl]);

  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  useEffect(() => {
    setActiveMediaIndex(0);
  }, [videoUrl, imageSlots[0]]);

  const currentMedia = mediaItems[activeMediaIndex] || mediaItems[0];

  // Keep video playing silently on loop just like front end
  useEffect(() => {
    if (currentMedia.type !== 'video') return;
    const videoEl = videoRef.current;
    if (!videoEl) return;
    videoEl.defaultMuted = true;
    videoEl.muted = true;
    videoEl.loop = true;
    videoEl.playsInline = true;
    videoEl.play().catch(() => {});
  }, [currentMedia]);

  const buildUpdatedOutfit = (
    overrideSlots?: [string, string, string, string],
    overrideVideo?: string,
    overrideAvailable?: boolean
  ): LehengaOutfit => {
    const slots = overrideSlots ?? imageSlots;
    const vid = (overrideVideo !== undefined ? overrideVideo : videoUrl).trim();
    const avail = overrideAvailable ?? available;

    const validImages = slots.map((s) => s.trim()).filter(Boolean).slice(0, 4);
    const fallbackImage =
      validImages[0] ||
      (outfit.mediaType === 'image' && outfit.mediaUrl ? outfit.mediaUrl : '') ||
      '/images/lehenga-orange-zardosi.jpg';
    const primaryMediaUrl = validImages[0] || vid || fallbackImage;
    const primaryMediaType: 'image' | 'video' =
      validImages.length > 0 ? 'image' : vid ? 'video' : 'image';
    const finalImages =
      validImages.length > 0
        ? validImages
        : primaryMediaType === 'image'
        ? [primaryMediaUrl]
        : [];

    const parsedSizes = sizesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      ...outfit,
      code: code.trim().toUpperCase() || outfit.code,
      title: title.trim() || outfit.title,
      vibeCategory: vibeCategory.trim() || 'Navratri Ni Pehvesh',
      description: description.trim(),
      pricePerDay: Math.max(100, Number(pricePerDay) || outfit.pricePerDay),
      sizes: parsedSizes.length > 0 ? parsedSizes : ['XS-S', 'M-L'],
      available: avail,
      mediaUrl: primaryMediaUrl,
      mediaType: primaryMediaType,
      images: finalImages,
      videoUrl: vid,
    };
  };

  const hasUnsavedChanges = useMemo(() => {
    const currentImgs =
      Array.isArray(outfit.images) && outfit.images.length > 0
        ? outfit.images
        : outfit.mediaType === 'image' && outfit.mediaUrl
        ? [outfit.mediaUrl]
        : [];
    const savedSlots = [
      currentImgs[0] || '',
      currentImgs[1] || '',
      currentImgs[2] || '',
      currentImgs[3] || '',
    ];
    const savedVid = outfit.videoUrl || (outfit.mediaType === 'video' ? outfit.mediaUrl : '');

    return (
      code.trim().toUpperCase() !== outfit.code ||
      title.trim() !== outfit.title ||
      vibeCategory.trim() !== outfit.vibeCategory ||
      description.trim() !== outfit.description ||
      Number(pricePerDay) !== outfit.pricePerDay ||
      sizesText.trim() !== outfit.sizes.join(', ') ||
      available !== outfit.available ||
      videoUrl.trim() !== savedVid ||
      JSON.stringify(imageSlots) !== JSON.stringify(savedSlots)
    );
  }, [
    code,
    title,
    vibeCategory,
    description,
    pricePerDay,
    sizesText,
    available,
    videoUrl,
    imageSlots,
    outfit,
  ]);

  const handleSaveCard = async (
    customSlots?: [string, string, string, string],
    customVid?: string,
    customAvail?: boolean,
    toastMsg?: string
  ) => {
    setIsSaving(true);
    try {
      const nextOutfit = buildUpdatedOutfit(customSlots, customVid, customAvail);
      await onSaveOutfit(
        nextOutfit,
        toastMsg || `Synced "${nextOutfit.title}" (${nextOutfit.code}) to live storefront!`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (slotIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSlot(`img-${slotIdx}`);
    try {
      const url = await uploadFileToBackend(file, `lehenga-img-${slotIdx + 1}`);
      const nextSlots = [...imageSlots] as [string, string, string, string];
      nextSlots[slotIdx] = url;
      setImageSlots(nextSlots);
      await handleSaveCard(
        nextSlots,
        undefined,
        undefined,
        `Uploaded & synced Photo ${slotIdx + 1} for ${code}!`
      );
    } finally {
      setUploadingSlot(null);
      e.target.value = '';
    }
  };

  const handleBatchPhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 4);
    if (files.length === 0) return;
    setUploadingSlot('batch');
    try {
      const urls = await Promise.all(
        files.map((f, idx) => uploadFileToBackend(f, `lehenga-img-${idx + 1}`))
      );
      const nextSlots = [...imageSlots] as [string, string, string, string];
      for (let i = 0; i < urls.length && i < 4; i++) {
        nextSlots[i] = urls[i];
      }
      setImageSlots(nextSlots);
      await handleSaveCard(
        nextSlots,
        undefined,
        undefined,
        `Uploaded & synced ${urls.length} photo(s) for ${code}!`
      );
    } finally {
      setUploadingSlot(null);
      e.target.value = '';
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSlot('video');
    try {
      const url = await uploadFileToBackend(file, 'lehenga-video');
      setVideoUrl(url);
      setActiveMediaIndex(0);
      await handleSaveCard(
        undefined,
        url,
        undefined,
        `Uploaded & synced primary looping Video for ${code}!`
      );
    } finally {
      setUploadingSlot(null);
      e.target.value = '';
    }
  };

  return (
    <article className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-[#F8BBD0]/80 hover:border-[#D81B60] transition-all duration-300 shadow-[0_12px_32px_-12px_rgba(216,27,96,0.12)]">
      {/* 3:4 Full-Length Portrait Stage — Exact Match with Front End */}
      <div className="relative aspect-[3/4] w-full bg-[#FFF0F5] overflow-hidden">
        {currentMedia.type === 'video' ? (
          <video
            ref={videoRef}
            key={currentMedia.url}
            src={currentMedia.url}
            onClick={() => onOpenDetailEditor(buildUpdatedOutfit())}
            className="w-full h-full object-cover object-top cursor-pointer"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onCanPlay={(e) => {
              e.currentTarget.muted = true;
              e.currentTarget.play().catch(() => {});
            }}
            onPause={(e) => {
              e.currentTarget.muted = true;
              e.currentTarget.play().catch(() => {});
            }}
          />
        ) : (
          <img
            src={currentMedia.url}
            alt={title}
            onClick={() => onOpenDetailEditor(buildUpdatedOutfit())}
            className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105 cursor-pointer"
          />
        )}

        {/* Top Row: Editable SKU Pill & Quick Actions (Media Drawer, Detail View, Delete) */}
        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2 z-10">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onBlur={() => {
              if (hasUnsavedChanges) handleSaveCard();
            }}
            title="Click to edit SKU code"
            className="w-28 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md border border-[#F8BBD0] text-[10px] font-mono-num uppercase tracking-wider text-[#4A1525] font-semibold focus:outline-none focus:border-[#D81B60] shadow-xs"
          />

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowMediaTray((prev) => !prev)}
              title="Edit 4 Photos & 1 Video"
              className={`px-2.5 py-1.5 rounded-full text-[10px] font-semibold backdrop-blur-md border transition-colors inline-flex items-center gap-1 shadow-xs cursor-pointer ${
                showMediaTray
                  ? 'bg-[#D81B60] text-white border-[#D81B60]'
                  : 'bg-white/95 text-[#4A1525] border-[#F8BBD0] hover:bg-[#FFF0F5]'
              }`}
            >
              <Upload className="w-3 h-3" />
              <span>{showMediaTray ? 'Done Media' : 'Edit Media'}</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenDetailEditor(buildUpdatedOutfit())}
              title="Open Full Detail Page View & Editor"
              className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-md border border-[#F8BBD0] flex items-center justify-center text-[#4A1525] hover:text-[#D81B60] hover:bg-[#FFF0F5] transition-colors shadow-xs cursor-pointer"
            >
              <Eye className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onDeleteOutfit(outfit.id)}
              title="Delete Listing"
              className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-md border border-[#F8BBD0] flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors shadow-xs cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Overlay Media Manager (1 Video + 4 Photos) right inside the 3:4 Card */}
        {showMediaTray && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-2.5 top-14 bottom-12 z-20 rounded-2xl bg-white/96 backdrop-blur-md border border-[#F8BBD0] p-3 overflow-y-auto luxury-scroll shadow-xl flex flex-col justify-between space-y-2.5"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-[#FCE4EC] pb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#D81B60]">
                  Card Media (1 Looping Video + 4 Photos)
                </span>
                <input
                  ref={batchPhotosInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleBatchPhotosUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => batchPhotosInputRef.current?.click()}
                  className="px-2 py-0.5 rounded bg-[#4A1525] text-white text-[9px] font-semibold hover:bg-[#D81B60] cursor-pointer"
                >
                  {uploadingSlot === 'batch' ? 'Uploading...' : '+ Upload 4 Photos'}
                </button>
              </div>

              {/* Optional Video Slot (Uses Photo 1 on main thumbnail when empty or cleared) */}
              <div className="p-2 rounded-xl bg-[#FFF0F5] border border-[#F8BBD0] space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-semibold text-[#4A1525] flex items-center gap-1">
                    <Film className="w-3 h-3 text-[#D81B60]" />
                    <span>Optional Video (Shows Photo 1 if empty)</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={videoFileInputRef}
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/*"
                      onChange={handleVideoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => videoFileInputRef.current?.click()}
                      className="px-2 py-0.5 rounded bg-[#D81B60] text-white text-[9px] font-semibold cursor-pointer"
                    >
                      {uploadingSlot === 'video' ? 'Uploading...' : 'Upload Video'}
                    </button>
                    {videoUrl.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          setVideoUrl('');
                          setActiveMediaIndex(0);
                          handleSaveCard(
                            undefined,
                            '',
                            undefined,
                            `Cleared video for ${code} — Photo 1 is now the main thumbnail!`
                          );
                        }}
                        className="px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-[9px] text-red-600 font-semibold hover:bg-red-100 cursor-pointer"
                      >
                        Clear Video
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setVideoUrl(nextVal);
                    if (!nextVal.trim()) {
                      setActiveMediaIndex(0);
                    }
                  }}
                  onBlur={() => handleSaveCard(undefined, videoUrl.trim())}
                  placeholder="Optional: Leave empty to show Photo 1 as main thumbnail..."
                  className="w-full px-2 py-1 rounded-lg bg-white border border-[#F8BBD0] text-[10px] text-[#4A1525] focus:outline-none focus:border-[#D81B60]"
                />
              </div>

              {/* 4 Photo Slots */}
              <div className="space-y-1.5">
                {[0, 1, 2, 3].map((slotIdx) => (
                  <div
                    key={slotIdx}
                    className="flex items-center gap-2 p-1.5 rounded-xl bg-[#FFF9FB] border border-[#F8BBD0]/70"
                  >
                    <div className="w-8 h-10 rounded-md overflow-hidden bg-[#FFF0F5] border border-[#F8BBD0] shrink-0 flex items-center justify-center">
                      {imageSlots[slotIdx] ? (
                        <img
                          src={imageSlots[slotIdx]}
                          alt={`Photo ${slotIdx + 1}`}
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5 text-[#4A1525]/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={imageSlots[slotIdx]}
                        onChange={(e) => {
                          const next = [...imageSlots] as [string, string, string, string];
                          next[slotIdx] = e.target.value;
                          setImageSlots(next);
                        }}
                        onBlur={() => handleSaveCard()}
                        placeholder={`Photo ${slotIdx + 1} URL...`}
                        className="w-full px-2 py-1 rounded bg-white border border-[#F8BBD0] text-[10px] text-[#4A1525] focus:outline-none focus:border-[#D81B60]"
                      />
                    </div>
                    <input
                      ref={photoFileInputRefs[slotIdx]}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(slotIdx, e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => photoFileInputRefs[slotIdx].current?.click()}
                      className="px-2 py-1 rounded-lg bg-[#FFF0F5] hover:bg-[#D81B60] hover:text-white text-[9px] font-semibold text-[#4A1525] border border-[#F8BBD0] shrink-0 cursor-pointer"
                    >
                      {uploadingSlot === `img-${slotIdx}` ? '...' : `Upload #${slotIdx + 1}`}
                    </button>
                    {imageSlots[slotIdx] && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...imageSlots] as [string, string, string, string];
                          next[slotIdx] = '';
                          setImageSlots(next);
                          handleSaveCard(next);
                        }}
                        className="text-red-500 hover:text-red-700 p-0.5 cursor-pointer"
                        title="Clear photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Front-End Media Switcher Bar at Bottom of 3:4 Portrait */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-1 bg-white/95 backdrop-blur-md border border-[#F8BBD0]/80 rounded-xl p-1 shadow-sm z-10"
        >
          {mediaItems.map((media, idx) => (
            <button
              key={`${media.label}-${idx}`}
              type="button"
              onClick={() => setActiveMediaIndex(idx)}
              className={`flex-1 py-1 px-1.5 text-[10px] font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1 cursor-pointer ${
                activeMediaIndex === idx
                  ? 'bg-[#D81B60] text-white'
                  : 'text-[#4A1525]/75 hover:text-[#D81B60]'
              }`}
            >
              {media.type === 'video' && <Film className="w-3 h-3 shrink-0" />}
              <span className="truncate">{media.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Editable Card Details — Styled Identically to Front-End ProductCard */}
      <div className="p-5 flex-1 flex flex-col justify-between bg-white">
        <div className="space-y-2">
          {/* Category & Availability Toggle */}
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] font-semibold">
            <input
              type="text"
              value={vibeCategory}
              onChange={(e) => setVibeCategory(e.target.value)}
              onBlur={() => {
                if (hasUnsavedChanges) handleSaveCard();
              }}
              placeholder="Occasion Category"
              title="Click to edit occasion category"
              className="flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-[#F8BBD0] focus:border-[#D81B60] text-[10px] uppercase tracking-[0.16em] text-[#880E4F]/80 font-semibold focus:outline-none py-0.5"
            />
            <button
              type="button"
              onClick={() => {
                const nextAvail = !available;
                setAvailable(nextAvail);
                handleSaveCard(undefined, undefined, nextAvail);
              }}
              className={`shrink-0 font-semibold cursor-pointer ${
                available ? 'text-emerald-700' : 'text-amber-600'
              }`}
              title="Click to toggle availability"
            >
              {available ? 'Available' : 'Booked'}
            </button>
          </div>

          {/* Editable Outfit Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (hasUnsavedChanges) handleSaveCard();
            }}
            placeholder="Outfit Title..."
            title="Click to edit outfit title"
            className="w-full font-editorial text-2xl font-semibold text-[#4A1525] leading-snug bg-transparent border-b border-transparent hover:border-[#F8BBD0] focus:border-[#D81B60] focus:outline-none py-0.5"
          />

          {/* Editable Description */}
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              if (hasUnsavedChanges) handleSaveCard();
            }}
            placeholder="Outfit description..."
            title="Click to edit description"
            className="w-full text-xs text-[#4A1525]/70 leading-relaxed bg-transparent border border-transparent hover:border-[#F8BBD0] focus:border-[#D81B60] focus:bg-[#FFF9FB] rounded-lg p-1 -mx-1 focus:outline-none resize-none"
          />

          {/* Editable Sizes Row */}
          <div className="pt-2.5 border-t border-[#FCE4EC] flex items-center justify-between gap-2 text-[11px] text-[#4A1525]/70">
            <span className="text-[10px] uppercase tracking-wider text-[#4A1525]/55 font-semibold shrink-0">
              Sizes
            </span>
            <input
              type="text"
              value={sizesText}
              onChange={(e) => setSizesText(e.target.value)}
              onBlur={() => {
                if (hasUnsavedChanges) handleSaveCard();
              }}
              placeholder="XS-S, M-L"
              title="Comma-separated sizes"
              className="w-40 text-right font-mono-num text-[10px] text-[#4A1525] bg-[#FFF0F5] px-2.5 py-1 rounded-full border border-[#F8BBD0]/80 focus:outline-none focus:border-[#D81B60]"
            />
          </div>
        </div>

        {/* Pricing & Action Row */}
        <div className="mt-4 pt-3.5 border-t border-[#FCE4EC] flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-semibold text-[#4A1525]">₹</span>
            <input
              type="number"
              value={pricePerDay}
              onChange={(e) => setPricePerDay(e.target.value)}
              onBlur={() => {
                if (hasUnsavedChanges) handleSaveCard();
              }}
              title="Click to edit daily rental price"
              className="w-20 text-lg font-semibold text-[#4A1525] bg-transparent border-b border-transparent hover:border-[#F8BBD0] focus:border-[#D81B60] focus:outline-none"
            />
            <span className="text-[11px] text-[#4A1525]/55">/ day</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenDetailEditor(buildUpdatedOutfit())}
              className="p-2.5 rounded-xl bg-[#FFF0F5] border border-[#F8BBD0] text-[#4A1525] hover:text-[#D81B60] hover:border-[#D81B60] transition-colors cursor-pointer"
              title="Open & Edit Full Detailed Listing Page"
            >
              <Eye className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleSaveCard()}
              disabled={isSaving}
              className={`px-3.5 py-2.5 rounded-xl text-xs uppercase tracking-wider font-semibold transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-[#D81B60] text-white hover:bg-[#AD1457]'
                  : 'bg-[#4A1525] text-white hover:bg-[#D81B60]'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Syncing...' : hasUnsavedChanges ? 'Save Sync' : 'Synced'}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  outfits,
  siteSettings,
  onUpdateSiteSettings,
  onAddOutfit,
  onUpdateOutfit,
  onDeleteOutfit,
  onBackToCatalog,
}) => {
  const [activeTab, setActiveTab] = useState<'lehengas' | 'banner' | 'branding'>('lehengas');
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Local editable copy of SiteSettings
  const [draftSettings, setDraftSettings] = useState<SiteSettings>(siteSettings);
  useEffect(() => {
    setDraftSettings(siteSettings);
  }, [siteSettings]);

  // Grid Filtering & Sorting (Matches Front End)
  const [selectedVibe, setSelectedVibe] = useState<string>('All Vibes');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');

  // Detailed Listing Page Editor state (Matches Front-End LookbookModal layout)
  const [detailEditOutfit, setDetailEditOutfit] = useState<LehengaOutfit | null>(null);
  const [detailActiveMediaIdx, setDetailActiveMediaIdx] = useState(0);
  const [detailIsZoomed, setDetailIsZoomed] = useState(false);
  const [detailZoomOrigin, setDetailZoomOrigin] = useState({ x: 50, y: 35 });
  const [detailUploadingSlot, setDetailUploadingSlot] = useState<string | null>(null);
  const detailMainVideoRef = useRef<HTMLVideoElement | null>(null);
  const detailPhotoInputRefs = [
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
  ];
  const detailVideoInputRef = useRef<HTMLInputElement | null>(null);

  const heroVideoInputRef = useRef<HTMLInputElement | null>(null);
  const heroPosterInputRef = useRef<HTMLInputElement | null>(null);
  const topLogoInputRef = useRef<HTMLInputElement | null>(null);
  const bottomLogoInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  // Dynamic Occasion Tabs (Identical to Front End)
  const dynamicVibeFilters = useMemo(() => {
    const primaryLabel = draftSettings.curatedCollectionTitle || 'Navratri Ni Pehvesh';
    return [{ label: primaryLabel, value: 'All Vibes' }];
  }, [draftSettings.curatedCollectionTitle]);

  const filteredOutfits = useMemo(() => {
    return outfits
      .filter((item) => {
        if (selectedVibe !== 'All Vibes' && item.vibeCategory !== selectedVibe) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            item.title.toLowerCase().includes(q) ||
            item.code.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            item.vibeCategory.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.pricePerDay - b.pricePerDay;
        if (sortBy === 'price-desc') return b.pricePerDay - a.pricePerDay;
        return 0;
      });
  }, [outfits, selectedVibe, searchQuery, sortBy]);

  const handleSaveSettings = async (nextSettings: SiteSettings, message: string) => {
    setIsSavingSettings(true);
    try {
      setDraftSettings(nextSettings);
      await onUpdateSiteSettings(nextSettings);
      showToast(message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Create a new lehenga card immediately in the grid so admin can edit it inline or in detail view
  const handleCreateNewListingCard = async () => {
    const nextNum = String(outfits.length + 1).padStart(2, '0');
    const newCode = `LOL-IND-${nextNum}`;
    const newOutfit: LehengaOutfit = {
      id: `lol-custom-${Date.now()}`,
      code: newCode,
      title: `New Designer Lehenga ${nextNum}`,
      pricePerDay: 2499,
      description:
        'Heavy mirror work, vibrant traditional prints, and custom-altered flare ready for Garba & Sangeet nights.',
      ogHumorTagline:
        'Why spend a fortune when you can break Instagram for ₹2,499/day? Rent it, flex it, return it tomorrow.',
      mediaUrl: '/images/lehenga-orange-zardosi.jpg',
      mediaType: 'image',
      images: ['/images/lehenga-orange-zardosi.jpg'],
      videoUrl: undefined,
      vibeCategory:
        selectedVibe === 'All Vibes'
          ? draftSettings.curatedCollectionTitle || 'Navratri Ni Pehvesh'
          : selectedVibe,
      sizes: ['XS-S', 'M-L'],
      available: true,
      createdAt: new Date().toISOString(),
    };
    await onAddOutfit(newOutfit);
    showToast(`Added new listing card ${newCode} — edit its photos, video, and text directly below!`);
  };

  // Detailed Page Editor Media Gallery (4 Photos + 1 Video)
  const detailMediaGallery = useMemo(() => {
    if (!detailEditOutfit) return [];
    const imgs =
      Array.isArray(detailEditOutfit.images) && detailEditOutfit.images.length > 0
        ? detailEditOutfit.images
        : detailEditOutfit.mediaType === 'image' && detailEditOutfit.mediaUrl
        ? [detailEditOutfit.mediaUrl]
        : [];
    const slots = [
      imgs[0] || '/images/lehenga-orange-zardosi.jpg',
      imgs[1] || '',
      imgs[2] || '',
      imgs[3] || '',
    ];
    const vid =
      detailEditOutfit.videoUrl ||
      (detailEditOutfit.mediaType === 'video' ? detailEditOutfit.mediaUrl : '');

    return [
      { type: 'image' as const, url: slots[0], label: 'Photo 1', slotIndex: 0 },
      { type: 'image' as const, url: slots[1], label: 'Photo 2', slotIndex: 1 },
      { type: 'image' as const, url: slots[2], label: 'Photo 3', slotIndex: 2 },
      { type: 'image' as const, url: slots[3], label: 'Photo 4', slotIndex: 3 },
      { type: 'video' as const, url: vid, label: 'Video', slotIndex: 4 },
    ];
  }, [detailEditOutfit]);

  const activeDetailMedia = detailMediaGallery[detailActiveMediaIdx] || detailMediaGallery[0];

  useEffect(() => {
    if (!activeDetailMedia || activeDetailMedia.type !== 'video' || !activeDetailMedia.url) return;
    const v = detailMainVideoRef.current;
    if (!v) return;
    v.defaultMuted = true;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.play().catch(() => {});
  }, [activeDetailMedia]);

  const handleSaveDetailOutfit = async (updated: LehengaOutfit, msg?: string) => {
    setDetailEditOutfit(updated);
    await onUpdateOutfit(updated);
    if (msg) showToast(msg);
  };

  const handleDetailPhotoUpload = async (
    slotIdx: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!detailEditOutfit) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setDetailUploadingSlot(`img-${slotIdx}`);
    try {
      const uploadedUrl = await uploadFileToBackend(file, `lehenga-img-${slotIdx + 1}`);
      const existing = Array.isArray(detailEditOutfit.images) ? [...detailEditOutfit.images] : [];
      const slots = [
        existing[0] || detailEditOutfit.mediaUrl || '',
        existing[1] || '',
        existing[2] || '',
        existing[3] || '',
      ];
      slots[slotIdx] = uploadedUrl;
      const validImages = slots.map((s) => s.trim()).filter(Boolean);
      const primaryMediaUrl =
        validImages[0] || detailEditOutfit.videoUrl || '/images/lehenga-orange-zardosi.jpg';
      const nextOutfit: LehengaOutfit = {
        ...detailEditOutfit,
        images: validImages,
        mediaUrl: primaryMediaUrl,
        mediaType: validImages.length > 0 ? 'image' : detailEditOutfit.videoUrl ? 'video' : 'image',
      };
      setDetailActiveMediaIdx(slotIdx);
      await handleSaveDetailOutfit(
        nextOutfit,
        `Updated Photo ${slotIdx + 1} for ${detailEditOutfit.code}!`
      );
    } finally {
      setDetailUploadingSlot(null);
      e.target.value = '';
    }
  };

  const handleDetailVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!detailEditOutfit) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setDetailUploadingSlot('video');
    try {
      const uploadedUrl = await uploadFileToBackend(file, 'lehenga-video');
      const nextOutfit: LehengaOutfit = {
        ...detailEditOutfit,
        videoUrl: uploadedUrl,
      };
      setDetailActiveMediaIdx(4);
      await handleSaveDetailOutfit(
        nextOutfit,
        `Uploaded looping Video for ${detailEditOutfit.code} (now front-grid thumbnail)!`
      );
    } finally {
      setDetailUploadingSlot(null);
      e.target.value = '';
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Backend Admin Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-[#F8BBD0] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[#D81B60]">
            <span>Live Visual Backend Studio</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num text-[#4A1525]/60">/admin</span>
          </div>
          <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#4A1525] mt-0.5">
            Visual Storefront & Listing Editor
          </h1>
          <p className="text-xs text-[#4A1525]/70 mt-0.5">
            Edit any text, price, photo, or looping video directly on the storefront grid or
            detailed listing view below—everything syncs live to the customer front end.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode Tabs */}
          <div className="flex items-center gap-1.5 bg-[#FFF0F5] p-1.5 rounded-xl border border-[#F8BBD0]">
            <button
              type="button"
              onClick={() => {
                setActiveTab('lehengas');
                setDetailEditOutfit(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'lehengas'
                  ? 'bg-[#D81B60] text-white shadow-2xs'
                  : 'text-[#4A1525]/75 hover:text-[#D81B60]'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Storefront Grid ({outfits.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('banner');
                setDetailEditOutfit(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'banner'
                  ? 'bg-[#D81B60] text-white shadow-2xs'
                  : 'text-[#4A1525]/75 hover:text-[#D81B60]'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Hero Banner</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('branding');
                setDetailEditOutfit(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'branding'
                  ? 'bg-[#D81B60] text-white shadow-2xs'
                  : 'text-[#4A1525]/75 hover:text-[#D81B60]'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Logos & Brand</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onBackToCatalog}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4A1525] text-white text-xs font-semibold hover:bg-[#D81B60] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>View Customer Site</span>
            <ExternalLink className="w-3 h-3 opacity-75" />
          </button>
        </div>
      </div>

      {successBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* TAB 1: VISUAL STOREFRONT GRID & DETAILED PAGE EDITOR */}
      {activeTab === 'lehengas' && (
        <>
          {detailEditOutfit ? (
            /* FULL DETAILED LISTING PAGE VISUAL EDITOR (Matches LookbookModal 1:1) */
            <div className="space-y-6">
              {/* Top Breadcrumb Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-[#F8BBD0]/70">
                <div className="flex items-center gap-2 text-xs text-[#4A1525]/75">
                  <button
                    type="button"
                    onClick={() => setDetailEditOutfit(null)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-[#F8BBD0] text-[#4A1525] font-semibold hover:bg-[#FFF0F5] hover:text-[#D81B60] transition-colors cursor-pointer shadow-2xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Backend Grid</span>
                  </button>
                  <ChevronRight className="w-3.5 h-3.5 text-[#4A1525]/35 hidden sm:block" />
                  <span className="text-[#D81B60] font-semibold">
                    Detailed Listing Page Live Editor
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#4A1525]/35 hidden sm:block" />
                  <span className="font-mono-num font-semibold text-[#4A1525]">
                    {detailEditOutfit.code}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleSaveDetailOutfit(
                      detailEditOutfit,
                      `Saved & synced "${detailEditOutfit.title}" (${detailEditOutfit.code}) to storefront!`
                    )
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D81B60] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#AD1457] transition-colors cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save & Sync Listing</span>
                </button>
              </div>

              {/* Exact Front-End Detailed Listing Layout */}
              <div className="w-full bg-white rounded-3xl overflow-hidden shadow-[0_24px_60px_-15px_rgba(216,27,96,0.12)] border border-[#F8BBD0]/80 grid grid-cols-1 lg:grid-cols-12">
                {/* Left Column: Vertical Thumbnail Rail (4 Photos + 1 Video) + Main 3:4 Portrait Stage */}
                <div className="lg:col-span-7 p-4 sm:p-6 bg-[#FFF5F8]/60 flex flex-col-reverse sm:flex-row gap-4 items-stretch">
                  {/* Vertical Thumbnail Rail with Upload Triggers */}
                  <div className="flex sm:flex-col gap-2.5 overflow-x-auto sm:overflow-y-auto no-scrollbar shrink-0 sm:w-24">
                    {detailMediaGallery.map((item, idx) => {
                      const isActive = detailActiveMediaIdx === idx;
                      const isVideoSlot = item.type === 'video';
                      return (
                        <div
                          key={item.label}
                          className={`relative rounded-xl overflow-hidden border-2 transition-all shrink-0 w-20 sm:w-24 ${
                            isActive
                              ? 'border-[#D81B60] ring-2 ring-[#D81B60]/25 shadow-sm'
                              : 'border-[#F8BBD0]/80 opacity-85 hover:opacity-100'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setDetailActiveMediaIdx(idx);
                              setDetailIsZoomed(false);
                            }}
                            className="relative w-full h-22 sm:h-26 block bg-[#FFF0F5] cursor-pointer"
                          >
                            {isVideoSlot ? (
                              item.url ? (
                                <div className="relative w-full h-full bg-[#2B180A]">
                                  <video
                                    src={item.url}
                                    className="w-full h-full object-cover object-top"
                                    muted
                                    loop
                                    autoPlay
                                    playsInline
                                  />
                                  <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center text-white">
                                    <span className="w-6 h-6 rounded-full bg-white/90 text-[#D81B60] flex items-center justify-center">
                                      <Play className="w-3 h-3 fill-current ml-0.5" />
                                    </span>
                                    <span className="text-[8px] uppercase tracking-wider font-bold mt-1">
                                      Video
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-[#D81B60] p-1 text-center">
                                  <Film className="w-4 h-4 mb-1" />
                                  <span className="text-[9px] font-semibold">Add Video</span>
                                </div>
                              )
                            ) : item.url ? (
                              <img
                                src={item.url}
                                alt={item.label}
                                className="w-full h-full object-cover object-top"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-[#4A1525]/40 p-1 text-center">
                                <ImageIcon className="w-4 h-4 mb-1" />
                                <span className="text-[9px] font-semibold">{item.label}</span>
                              </div>
                            )}
                          </button>

                          {/* Upload / Clear Button on Bottom of Each Rail Slot */}
                          {isVideoSlot ? (
                            <div className="flex flex-col">
                              <input
                                ref={detailVideoInputRef}
                                type="file"
                                accept="video/mp4,video/webm,video/quicktime,video/*"
                                onChange={handleDetailVideoUpload}
                                className="hidden"
                              />
                              <button
                                type="button"
                                onClick={() => detailVideoInputRef.current?.click()}
                                className="w-full py-1 bg-[#4A1525] hover:bg-[#D81B60] text-white text-[9px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Upload className="w-2.5 h-2.5" />
                                <span>
                                  {detailUploadingSlot === 'video' ? '...' : 'Upload Vid'}
                                </span>
                              </button>
                              {item.url && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const firstImg =
                                      (Array.isArray(detailEditOutfit.images) &&
                                        detailEditOutfit.images[0]) ||
                                      '/images/lehenga-orange-zardosi.jpg';
                                    const nextOutfit: LehengaOutfit = {
                                      ...detailEditOutfit,
                                      videoUrl: '',
                                      mediaType: 'image',
                                      mediaUrl: firstImg,
                                    };
                                    setDetailActiveMediaIdx(0);
                                    handleSaveDetailOutfit(
                                      nextOutfit,
                                      `Cleared video for ${detailEditOutfit.code} — Photo 1 is now the main thumbnail!`
                                    );
                                  }}
                                  className="w-full py-0.5 bg-red-50 hover:bg-red-100 text-red-600 text-[8.5px] font-semibold uppercase tracking-wider border-t border-red-200 cursor-pointer"
                                >
                                  Clear Video
                                </button>
                              )}
                            </div>
                          ) : (
                            <>
                              <input
                                ref={detailPhotoInputRefs[item.slotIndex]}
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleDetailPhotoUpload(item.slotIndex, e)}
                                className="hidden"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  detailPhotoInputRefs[item.slotIndex].current?.click()
                                }
                                className="w-full py-1 bg-[#FFF0F5] hover:bg-[#D81B60] hover:text-white text-[#4A1525] text-[9px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1 border-t border-[#F8BBD0] cursor-pointer"
                              >
                                <Upload className="w-2.5 h-2.5" />
                                <span>
                                  {detailUploadingSlot === `img-${item.slotIndex}`
                                    ? '...'
                                    : item.label}
                                </span>
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Main 3:4 Portrait Stage */}
                  <div
                    onMouseMove={(e) => {
                      if (!detailIsZoomed) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      setDetailZoomOrigin({
                        x: Math.max(0, Math.min(100, x)),
                        y: Math.max(0, Math.min(100, y)),
                      });
                    }}
                    className="relative flex-1 aspect-[3/4] rounded-2xl bg-[#FFF0F5] overflow-hidden border border-[#F8BBD0]/60"
                  >
                    {activeDetailMedia.type === 'video' ? (
                      activeDetailMedia.url ? (
                        <video
                          ref={detailMainVideoRef}
                          key={activeDetailMedia.url}
                          src={activeDetailMedia.url}
                          className="w-full h-full object-cover object-top"
                          autoPlay
                          muted
                          loop
                          playsInline
                          preload="auto"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
                          <Film className="w-10 h-10 text-[#D81B60]" />
                          <p className="text-sm font-semibold text-[#4A1525]">
                            No Video Selected for This Listing
                          </p>
                          <p className="text-xs text-[#4A1525]/65 max-w-xs">
                            Upload a video to make it the automatic silent looping thumbnail on the
                            front grid page.
                          </p>
                          <button
                            type="button"
                            onClick={() => detailVideoInputRef.current?.click()}
                            className="px-4 py-2 rounded-xl bg-[#D81B60] text-white text-xs font-semibold cursor-pointer"
                          >
                            Upload Video Now
                          </button>
                        </div>
                      )
                    ) : activeDetailMedia.url ? (
                      <img
                        src={activeDetailMedia.url}
                        alt={detailEditOutfit.title}
                        style={{
                          transformOrigin: `${detailZoomOrigin.x}% ${detailZoomOrigin.y}%`,
                        }}
                        className={`w-full h-full object-cover object-top transition-transform duration-300 ease-out ${
                          detailIsZoomed ? 'scale-[2]' : 'scale-100'
                        }`}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
                        <ImageIcon className="w-10 h-10 text-[#D81B60]" />
                        <p className="text-sm font-semibold text-[#4A1525]">
                          Empty {activeDetailMedia.label} Slot
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            detailPhotoInputRefs[activeDetailMedia.slotIndex].current?.click()
                          }
                          className="px-4 py-2 rounded-xl bg-[#D81B60] text-white text-xs font-semibold cursor-pointer"
                        >
                          Upload {activeDetailMedia.label}
                        </button>
                      </div>
                    )}

                    {/* Top-left Editable SKU Pill */}
                    <div className="absolute top-4 left-4 z-10">
                      <input
                        type="text"
                        value={detailEditOutfit.code}
                        onChange={(e) =>
                          setDetailEditOutfit({
                            ...detailEditOutfit,
                            code: e.target.value.toUpperCase(),
                          })
                        }
                        onBlur={() => handleSaveDetailOutfit(detailEditOutfit)}
                        className="w-32 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md border border-[#F8BBD0] text-[11px] font-mono-num font-semibold text-[#4A1525] shadow-2xs focus:outline-none focus:border-[#D81B60]"
                      />
                    </div>

                    {/* Floating Zoom Button */}
                    {activeDetailMedia.type === 'image' && activeDetailMedia.url && (
                      <button
                        type="button"
                        onClick={() => setDetailIsZoomed((prev) => !prev)}
                        className="absolute bottom-5 right-5 z-20 w-12 h-12 rounded-full bg-white/95 backdrop-blur-md border border-[#F8BBD0] shadow-lg flex items-center justify-center text-[#4A1525] hover:bg-[#D81B60] hover:text-white transition-all cursor-pointer"
                      >
                        {detailIsZoomed ? (
                          <ZoomOut className="w-5 h-5" />
                        ) : (
                          <ZoomIn className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Column: Editable Full-Page Luxury Editorial Details */}
                <div className="lg:col-span-5 p-6 sm:p-10 flex flex-col justify-between">
                  <div className="space-y-6">
                    {/* Editable Category */}
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={detailEditOutfit.vibeCategory}
                        onChange={(e) =>
                          setDetailEditOutfit({
                            ...detailEditOutfit,
                            vibeCategory: e.target.value,
                          })
                        }
                        onBlur={() => handleSaveDetailOutfit(detailEditOutfit)}
                        className="text-xs uppercase tracking-[0.2em] text-[#D81B60] font-semibold bg-[#FFF0F5] px-3 py-1.5 rounded-lg border border-[#F8BBD0] focus:outline-none focus:border-[#D81B60]"
                      />
                      <span className="text-[11px] text-emerald-700 font-semibold">
                        Live Detail Preview
                      </span>
                    </div>

                    {/* Editable Title & Pricing */}
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={detailEditOutfit.title}
                        onChange={(e) =>
                          setDetailEditOutfit({
                            ...detailEditOutfit,
                            title: e.target.value,
                          })
                        }
                        onBlur={() => handleSaveDetailOutfit(detailEditOutfit)}
                        className="w-full font-editorial text-3xl sm:text-4xl font-semibold text-[#4A1525] leading-tight bg-[#FFF9FB] px-3 py-1.5 rounded-xl border border-[#F8BBD0] focus:outline-none focus:border-[#D81B60]"
                      />

                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-semibold text-[#4A1525]">
                          ₹
                        </span>
                        <input
                          type="number"
                          value={detailEditOutfit.pricePerDay}
                          onChange={(e) =>
                            setDetailEditOutfit({
                              ...detailEditOutfit,
                              pricePerDay: Number(e.target.value) || 0,
                            })
                          }
                          onBlur={() => handleSaveDetailOutfit(detailEditOutfit)}
                          className="w-36 text-3xl sm:text-4xl font-semibold text-[#4A1525] bg-[#FFF9FB] px-3 py-1 rounded-xl border border-[#F8BBD0] focus:outline-none focus:border-[#D81B60]"
                        />
                        <span className="text-sm font-normal text-[#4A1525]/60">
                          / day rental
                        </span>
                      </div>
                    </div>

                    {/* Editable Description */}
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#4A1525]/55 font-semibold mb-1">
                        Listing Description
                      </label>
                      <textarea
                        rows={4}
                        value={detailEditOutfit.description}
                        onChange={(e) =>
                          setDetailEditOutfit({
                            ...detailEditOutfit,
                            description: e.target.value,
                          })
                        }
                        onBlur={() => handleSaveDetailOutfit(detailEditOutfit)}
                        className="w-full text-sm sm:text-base text-[#4A1525]/85 leading-relaxed bg-[#FFF9FB] p-3 rounded-xl border border-[#F8BBD0] focus:outline-none focus:border-[#D81B60]"
                      />
                    </div>

                    {/* Editable Sizes */}
                    <div className="pt-4 border-t border-[#F8BBD0]/60 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold uppercase tracking-wider text-[#4A1525] flex items-center gap-1.5">
                          <Ruler className="w-4 h-4 text-[#D81B60]" />
                          Sizes (Comma Separated)
                        </span>
                      </div>
                      <input
                        type="text"
                        value={detailEditOutfit.sizes.join(', ')}
                        onChange={(e) =>
                          setDetailEditOutfit({
                            ...detailEditOutfit,
                            sizes: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        onBlur={() => handleSaveDetailOutfit(detailEditOutfit)}
                        className="w-full px-3.5 py-2 rounded-xl bg-[#FFF9FB] border border-[#F8BBD0] text-xs font-semibold text-[#4A1525] focus:outline-none focus:border-[#D81B60]"
                      />
                      <div className="flex flex-wrap gap-2">
                        {detailEditOutfit.sizes.map((size) => (
                          <span
                            key={size}
                            className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#4A1525] bg-[#4A1525] text-white"
                          >
                            {size}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Studio Highlights (Same as Front End) */}
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#F8BBD0]/60">
                      <div className="p-3 rounded-xl bg-[#FFF5F8] border border-[#F8BBD0]/60 flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-[#D81B60] shrink-0" />
                        <span className="text-[11px] font-medium text-[#4A1525]/80">
                          Steam-Sanitized & Custom Altered
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FFF5F8] border border-[#F8BBD0]/60 flex items-center gap-2.5">
                        <Clock className="w-4 h-4 text-[#D81B60] shrink-0" />
                        <span className="text-[11px] font-medium text-[#4A1525]/80">
                          24-Hr Next-Day Return
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Save & Back Actions */}
                  <div className="pt-8 mt-8 border-t border-[#F8BBD0]/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => setDetailEditOutfit(null)}
                      className="px-5 py-4 rounded-2xl border border-[#F8BBD0] bg-white text-xs font-semibold text-[#4A1525] hover:bg-[#FFF0F5] transition-colors cursor-pointer"
                    >
                      Done / Back to Grid
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleSaveDetailOutfit(
                          detailEditOutfit,
                          `Synced "${detailEditOutfit.title}" to live storefront!`
                        )
                      }
                      className="flex-1 py-4 px-6 rounded-2xl bg-[#4A1525] text-white text-xs uppercase tracking-[0.16em] font-semibold hover:bg-[#D81B60] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save & Sync to Front End</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* FRONT-END IDENTICAL STOREFRONT GRID WITH IN-PLACE EDITING */
            <div className="space-y-8">
              {/* Editable Storefront Section Title & Subtitle (Exact Match to Front End) */}
              <div className="text-center max-w-2xl mx-auto space-y-2 p-5 rounded-2xl bg-white/80 border border-[#F8BBD0]/80 shadow-2xs">
                <input
                  type="text"
                  value={
                    draftSettings.catalogSectionKicker ??
                    DEFAULT_SITE_SETTINGS.catalogSectionKicker ??
                    '10/10 MANDAL VIBES ONLY'
                  }
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, catalogSectionKicker: e.target.value })
                  }
                  onBlur={() =>
                    handleSaveSettings(
                      draftSettings,
                      'Synced catalog section heading to live storefront!'
                    )
                  }
                  title="Click to edit section kicker (syncs to front end)"
                  className="w-full text-center text-[11px] uppercase tracking-[0.22em] text-[#D81B60] font-semibold bg-transparent border-b border-transparent hover:border-[#F8BBD0] focus:border-[#D81B60] focus:outline-none py-0.5"
                />

                <input
                  type="text"
                  value={
                    draftSettings.catalogSectionTitle ??
                    DEFAULT_SITE_SETTINGS.catalogSectionTitle ??
                    'The Garba Night Essentials'
                  }
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, catalogSectionTitle: e.target.value })
                  }
                  onBlur={() =>
                    handleSaveSettings(
                      draftSettings,
                      'Synced catalog section title to live storefront!'
                    )
                  }
                  title="Click to edit section title (syncs to front end)"
                  className="w-full text-center font-editorial text-3xl sm:text-5xl font-semibold text-[#4A1525] tracking-tight bg-transparent border-b border-transparent hover:border-[#F8BBD0] focus:border-[#D81B60] focus:outline-none py-0.5"
                />

                <textarea
                  rows={3}
                  value={
                    draftSettings.catalogSectionSubtitle ??
                    DEFAULT_SITE_SETTINGS.catalogSectionSubtitle ??
                    ''
                  }
                  onChange={(e) =>
                    setDraftSettings({
                      ...draftSettings,
                      catalogSectionSubtitle: e.target.value,
                    })
                  }
                  onBlur={() =>
                    handleSaveSettings(
                      draftSettings,
                      'Synced catalog section description to live storefront!'
                    )
                  }
                  title="Click to edit section subtitle (syncs to front end)"
                  className="w-full text-center text-xs sm:text-sm text-[#4A1525]/75 bg-transparent border border-transparent hover:border-[#F8BBD0] focus:border-[#D81B60] rounded-xl p-1.5 focus:outline-none resize-none"
                />
              </div>

              {/* Filter, Search, Sort & "+ Add New Lehenga" Bar (Exact Match to Front End) */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#F8BBD0]/60">
                {/* Occasion Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                  {dynamicVibeFilters.map((tab) => {
                    const active = selectedVibe === tab.value;
                    return (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => setSelectedVibe(tab.value)}
                        className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                          active
                            ? 'bg-[#D81B60] text-white shadow-xs'
                            : 'bg-white text-[#4A1525]/75 hover:text-[#D81B60] border border-[#F8BBD0]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Search, Sort & Add New Listing Controls */}
                <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 shrink-0">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#D81B60] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter SKU or title..."
                      className="pl-8 pr-3 py-2 rounded-full bg-white border border-[#F8BBD0] text-xs text-[#4A1525] focus:outline-none focus:border-[#D81B60] w-44"
                    />
                  </div>

                  <div className="relative inline-flex items-center">
                    <ArrowUpDown className="w-3.5 h-3.5 text-[#D81B60] absolute left-3 pointer-events-none" />
                    <select
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(e.target.value as 'featured' | 'price-asc' | 'price-desc')
                      }
                      className="pl-8 pr-4 py-2 rounded-full bg-white border border-[#F8BBD0] text-xs font-medium text-[#4A1525] focus:outline-none focus:border-[#D81B60] cursor-pointer"
                    >
                      <option value="featured">Sort: Featured</option>
                      <option value="price-asc">Rent: Low to High</option>
                      <option value="price-desc">Rent: High to Low</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateNewListingCard}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#D81B60] text-white text-xs font-semibold hover:bg-[#AD1457] transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New Listing</span>
                  </button>
                </div>
              </div>

              {/* 3-Column 3:4 Portrait Grid (Identical Layout to Front End) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7 lg:gap-8">
                {filteredOutfits.map((outfit) => (
                  <EditableGridCard
                    key={outfit.id}
                    outfit={outfit}
                    onSaveOutfit={async (updated, msg) => {
                      await onUpdateOutfit(updated);
                      if (msg) showToast(msg);
                    }}
                    onDeleteOutfit={async (id) => {
                      await onDeleteOutfit(id);
                      showToast('Removed listing from storefront.');
                    }}
                    onOpenDetailEditor={(o) => {
                      setDetailEditOutfit(o);
                      setDetailActiveMediaIdx(0);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  />
                ))}

                {/* Add New Lehenga Card Slot at End of Grid */}
                <button
                  type="button"
                  onClick={handleCreateNewListingCard}
                  className="group min-h-[520px] rounded-2xl border-2 border-dashed border-[#F48FB1] bg-white/60 hover:bg-[#FFF0F5]/70 hover:border-[#D81B60] transition-all flex flex-col items-center justify-center p-8 text-center space-y-3 cursor-pointer"
                >
                  <div className="w-14 h-14 rounded-full bg-[#FFF0F5] border border-[#F8BBD0] group-hover:bg-[#D81B60] group-hover:text-white text-[#D81B60] flex items-center justify-center transition-colors shadow-xs">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <span className="font-editorial text-2xl font-semibold text-[#4A1525] block">
                      Add New Lehenga Listing
                    </span>
                    <span className="text-xs text-[#4A1525]/65 block max-w-xs">
                      Click to add a new 3:4 card to this grid and upload its looping video, 4
                      photos, title, and daily rent.
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: HERO BANNER VIDEO & IMAGE MANAGER */}
      {activeTab === 'banner' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 bg-white rounded-2xl p-6 sm:p-8 border border-[#F8BBD0] shadow-xs space-y-6">
            <div className="border-b border-[#FCE4EC] pb-4">
              <h2 className="font-editorial text-2xl font-semibold text-[#4A1525]">
                Hero Banner Video & Image Settings
              </h2>
              <p className="text-xs text-[#4A1525]/65 mt-1">
                Upload your muted looping `.mp4` banner video or static banner image here.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/70 mb-2">
                Active Hero Banner Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    handleSaveSettings(
                      { ...draftSettings, heroMediaType: 'video' },
                      'Switched Hero Banner to Muted Looping Video mode.'
                    )
                  }
                  className={`py-3 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                    draftSettings.heroMediaType === 'video'
                      ? 'bg-[#D81B60] text-white border-[#D81B60]'
                      : 'bg-[#FFF5F8] text-[#4A1525]/75 border-[#F8BBD0]'
                  }`}
                >
                  <Film className="w-4 h-4" />
                  <span>Muted Video Banner (.mp4)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSaveSettings(
                      { ...draftSettings, heroMediaType: 'image' },
                      'Switched Hero Banner to Static Image mode.'
                    )
                  }
                  className={`py-3 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                    draftSettings.heroMediaType === 'image'
                      ? 'bg-[#D81B60] text-white border-[#D81B60]'
                      : 'bg-[#FFF5F8] text-[#4A1525]/75 border-[#F8BBD0]'
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Static Image Banner</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#FCE4EC]">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/70">
                Hero Banner Video (`.mp4` / `.webm`)
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={draftSettings.heroVideoUrl}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, heroVideoUrl: e.target.value })
                  }
                  placeholder="/uploads/hero-banner.mp4"
                  className="flex-1 px-3.5 py-2.5 bg-[#FFF5F8] border border-[#F8BBD0] rounded-xl text-xs text-[#4A1525]"
                />
                <input
                  ref={heroVideoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsSavingSettings(true);
                    try {
                      const url = await uploadFileToBackend(file, 'hero-banner-video');
                      await handleSaveSettings(
                        { ...draftSettings, heroVideoUrl: url, heroMediaType: 'video' },
                        'New Hero Banner MP4 Video uploaded and published to live site!'
                      );
                    } finally {
                      setIsSavingSettings(false);
                    }
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => heroVideoInputRef.current?.click()}
                  disabled={isSavingSettings}
                  className="px-4 py-2.5 rounded-xl bg-[#D81B60] hover:bg-[#AD1457] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isSavingSettings ? 'Uploading...' : 'Upload MP4 Video'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#FCE4EC]">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/70">
                Hero Banner Image / Video Poster (`.jpg` / `.png` / `.webp`)
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={draftSettings.heroPosterUrl}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, heroPosterUrl: e.target.value })
                  }
                  placeholder="/uploads/hero-poster.jpg"
                  className="flex-1 px-3.5 py-2.5 bg-[#FFF5F8] border border-[#F8BBD0] rounded-xl text-xs text-[#4A1525]"
                />
                <input
                  ref={heroPosterInputRef}
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsSavingSettings(true);
                    try {
                      const url = await uploadFileToBackend(file, 'hero-poster');
                      await handleSaveSettings(
                        { ...draftSettings, heroPosterUrl: url },
                        'Updated Hero Banner Poster / Image!'
                      );
                    } finally {
                      setIsSavingSettings(false);
                    }
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => heroPosterInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl border border-[#F8BBD0] bg-[#FFF5F8] hover:bg-white text-xs font-semibold text-[#4A1525] inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Upload className="w-3.5 h-3.5 text-[#D81B60]" />
                  <span>Upload Banner Image</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                handleSaveSettings(draftSettings, 'Saved Hero Banner settings to live storefront!')
              }
              className="w-full py-3.5 px-6 rounded-xl bg-[#4A1525] text-white text-xs uppercase tracking-[0.16em] font-semibold hover:bg-[#D81B60] transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Banner Settings</span>
            </button>
          </div>

          <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-[#F8BBD0] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-editorial text-2xl font-semibold text-[#4A1525]">
                Live Hero Banner Preview
              </h3>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#D81B60]">
                {draftSettings.heroMediaType === 'video' ? 'Playing Video Loop' : 'Static Image'}
              </span>
            </div>
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#2B180A] border border-[#F8BBD0]">
              {draftSettings.heroMediaType === 'image' ? (
                <img
                  src={draftSettings.heroPosterUrl}
                  alt="Banner Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  key={draftSettings.heroVideoUrl}
                  src={draftSettings.heroVideoUrl}
                  poster={draftSettings.heroPosterUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TOP & BOTTOM LOGOS & BRAND IDENTITY */}
      {activeTab === 'branding' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 bg-white rounded-2xl p-6 sm:p-8 border border-[#F8BBD0] shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-[#FCE4EC] pb-4">
              <div>
                <h2 className="font-editorial text-2xl font-semibold text-[#4A1525]">
                  Top & Bottom Logos & Studio Identity
                </h2>
                <p className="text-xs text-[#4A1525]/65 mt-1">
                  Upload custom logo images for the top navigation bar and bottom footer, or edit
                  the brand text and WhatsApp concierge details.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleSaveSettings(
                    DEFAULT_SITE_SETTINGS,
                    'Reset logos and branding to default settings.'
                  )
                }
                className="text-xs text-[#D81B60] hover:underline cursor-pointer"
              >
                Reset Defaults
              </button>
            </div>

            {/* Top Navbar Logo Upload */}
            <div className="space-y-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/70">
                Top Navbar Logo Image
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={draftSettings.topLogoUrl}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, topLogoUrl: e.target.value })
                  }
                  placeholder="Upload custom top logo PNG/SVG or leave empty for default..."
                  className="flex-1 px-3.5 py-2.5 bg-[#FFF5F8] border border-[#F8BBD0] rounded-xl text-xs text-[#4A1525]"
                />
                <input
                  ref={topLogoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await uploadFileToBackend(file, 'logo-top');
                    setDraftSettings({ ...draftSettings, topLogoUrl: url });
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => topLogoInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl border border-[#F8BBD0] bg-[#FFF5F8] hover:bg-white text-xs font-semibold text-[#4A1525] inline-flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <Upload className="w-3.5 h-3.5 text-[#D81B60]" />
                  <span>Upload Top Logo</span>
                </button>
                {draftSettings.topLogoUrl && (
                  <button
                    type="button"
                    onClick={() => setDraftSettings({ ...draftSettings, topLogoUrl: '' })}
                    className="px-3 py-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-medium cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-[#FFF5F8] border border-[#F8BBD0] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/75">
                    Top Logo Size (Height):{' '}
                    <strong className="text-[#D81B60] font-mono-num">
                      {draftSettings.topLogoHeight || 56}px
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={24}
                    max={140}
                    step={2}
                    value={draftSettings.topLogoHeight || 56}
                    onChange={(e) =>
                      setDraftSettings({
                        ...draftSettings,
                        topLogoHeight: Number(e.target.value),
                      })
                    }
                    className="flex-1 accent-[#D81B60] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Brand Text Lockup Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/70 mb-1.5">
                  Hindi / Emblem Mark
                </label>
                <input
                  type="text"
                  value={draftSettings.brandHindiMark}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, brandHindiMark: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-[#FFF5F8] border border-[#F8BBD0] rounded-xl text-xs text-[#4A1525]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/70 mb-1.5">
                  Top Brand Title
                </label>
                <input
                  type="text"
                  value={draftSettings.brandTitle}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, brandTitle: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-[#FFF5F8] border border-[#F8BBD0] rounded-xl text-xs text-[#4A1525]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/70 mb-1.5">
                  Top Brand Subtitle
                </label>
                <input
                  type="text"
                  value={draftSettings.brandSubtitle}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, brandSubtitle: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-[#FFF5F8] border border-[#F8BBD0] rounded-xl text-xs text-[#4A1525]"
                />
              </div>
            </div>

            {/* Bottom Footer Logo Upload */}
            <div className="space-y-3 pt-3 border-t border-[#FCE4EC]">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/70">
                Bottom Footer Logo Image
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={draftSettings.bottomLogoUrl}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, bottomLogoUrl: e.target.value })
                  }
                  placeholder="Upload custom bottom footer logo or leave empty for default..."
                  className="flex-1 px-3.5 py-2.5 bg-[#FFF5F8] border border-[#F8BBD0] rounded-xl text-xs text-[#4A1525]"
                />
                <input
                  ref={bottomLogoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await uploadFileToBackend(file, 'logo-bottom');
                    setDraftSettings({ ...draftSettings, bottomLogoUrl: url });
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => bottomLogoInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl border border-[#F8BBD0] bg-[#FFF5F8] hover:bg-white text-xs font-semibold text-[#4A1525] inline-flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <Upload className="w-3.5 h-3.5 text-[#D81B60]" />
                  <span>Upload Bottom Logo</span>
                </button>
                {draftSettings.bottomLogoUrl && (
                  <button
                    type="button"
                    onClick={() => setDraftSettings({ ...draftSettings, bottomLogoUrl: '' })}
                    className="px-3 py-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-medium cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Footer Bio, Curated Collection, Location & WhatsApp */}
            <div className="space-y-3 pt-3 border-t border-[#FCE4EC]">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/70 mb-1.5">
                  Curated Collection Title (Footer & Storefront)
                </label>
                <input
                  type="text"
                  value={draftSettings.curatedCollectionTitle ?? 'Navratri Ni Pehvesh'}
                  onChange={(e) =>
                    setDraftSettings({
                      ...draftSettings,
                      curatedCollectionTitle: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-[#FFF5F8] border border-[#F8BBD0] rounded-xl text-xs text-[#4A1525]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/70 mb-1.5">
                  Footer Brand Description
                </label>
                <textarea
                  rows={2}
                  value={draftSettings.footerDescription}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, footerDescription: e.target.value })
                  }
                  className="w-full p-3 bg-[#FFF5F8] border border-[#F8BBD0] rounded-xl text-xs text-[#4A1525]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/70 mb-1.5">
                    Studio Address / Location
                  </label>
                  <input
                    type="text"
                    value={draftSettings.studioLocation}
                    onChange={(e) =>
                      setDraftSettings({ ...draftSettings, studioLocation: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-[#FFF5F8] border border-[#F8BBD0] rounded-xl text-xs text-[#4A1525]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/70 mb-1.5">
                    WhatsApp Concierge Number
                  </label>
                  <input
                    type="text"
                    value={draftSettings.whatsappNumber}
                    onChange={(e) =>
                      setDraftSettings({ ...draftSettings, whatsappNumber: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-[#FFF5F8] border border-[#F8BBD0] rounded-xl text-xs text-[#4A1525]"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                handleSaveSettings(
                  draftSettings,
                  'Saved Top & Bottom Logos and Brand Identity to live storefront!'
                )
              }
              className="w-full py-3.5 px-6 rounded-xl bg-[#4A1525] text-white text-xs uppercase tracking-[0.16em] font-semibold hover:bg-[#D81B60] transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Branding & Logos</span>
            </button>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-[#F8BBD0] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-[#D81B60] font-semibold">
                  Top Navbar Logo Preview
                </span>
                <span className="text-[10px] font-mono-num text-[#4A1525]/60">
                  Height: {draftSettings.topLogoHeight || 56}px
                </span>
              </div>
              <div className="p-4 rounded-xl bg-[#FFF5F8] border border-[#F8BBD0] flex items-center gap-3 overflow-hidden">
                {draftSettings.topLogoUrl ? (
                  <img
                    src={draftSettings.topLogoUrl}
                    alt="Top Logo Preview"
                    style={{ height: `${draftSettings.topLogoHeight || 56}px` }}
                    className="w-auto object-contain"
                  />
                ) : (
                  <LolBrandLogo variant="navbar" />
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-[#F8BBD0] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-[#D81B60] font-semibold">
                  Bottom Footer Logo Preview
                </span>
                <span className="text-[10px] font-mono-num text-[#4A1525]/60">
                  Height: {draftSettings.bottomLogoHeight || 88}px
                </span>
              </div>
              <div className="p-5 rounded-xl bg-[#FCE4EC] text-[#4A1525] flex flex-col items-center justify-center overflow-hidden">
                {draftSettings.bottomLogoUrl ? (
                  <img
                    src={draftSettings.bottomLogoUrl}
                    alt="Bottom Logo Preview"
                    style={{ height: `${draftSettings.bottomLogoHeight || 88}px` }}
                    className="w-auto object-contain"
                  />
                ) : (
                  <LolBrandLogo variant="full" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
