import React, { useState, useRef } from 'react';
import {
  Plus,
  Trash2,
  Upload,
  Tag,
  IndianRupee,
  CheckCircle2,
  ArrowLeft,
  Film,
  Image as ImageIcon,
  Palette,
  ShoppingBag,
  Edit3,
  ExternalLink,
  Save,
  X,
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

const HUMOR_TEMPLATES = [
  {
    label: 'Bua-Ji Distractor',
    description:
      "So blindingly gorgeous that relatives will forget to ask 'Beta, aage kya plan hai?' Pure raw silk with antique gold zardosi. Zero storage trauma, 100% Instagram feed dominance.",
    ogTagline:
      'Why spend a fortune when you can break Instagram for ₹2,499/day? Rent it, flex it, return it tomorrow. 🔥',
  },
  {
    label: 'Ex’s Cousin’s Shaadi',
    description:
      'Rich couture silhouette paired with hand-cut mirror work and a sheer organza drape. Designed specifically for walking past people you pretend not to know in slow motion.',
    ogTagline:
      'Look like old money on a Chappan Dukan budget. Designer couture for ₹2,499/day—no commitment, just vibes. ✨',
  },
  {
    label: 'Both Hands Free For Chaat',
    description:
      'Featherlight can-can flare with a pre-draped cape dupatta. No heavy safety-pin battles required—keeps both hands free for mocktails and dancing.',
    ogTagline:
      'Built for 4K slow-mo twirls and zero credit card regret. Lease today, return tomorrow! 💃',
  },
];

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

  // Local editable copy of SiteSettings for Banner & Logos
  const [draftSettings, setDraftSettings] = useState<SiteSettings>(siteSettings);

  // Lehenga Add / Edit Form State
  const nextSkuNumber = outfits.length + 1;
  const defaultCode = `LOL-IND-0${nextSkuNumber}`;

  const [editingOutfitId, setEditingOutfitId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState(defaultCode);
  const [pricePerDay, setPricePerDay] = useState('2499');
  const [vibeCategory, setVibeCategory] = useState('Sangeet Main Character');
  const [sizesInput, setSizesInput] = useState('XS-S, M-L');
  const [description, setDescription] = useState(HUMOR_TEMPLATES[0].description);
  const [ogHumorTagline, setOgHumorTagline] = useState(HUMOR_TEMPLATES[0].ogTagline);

  // 4 Images + 1 Video state
  const [imageSlots, setImageSlots] = useState<[string, string, string, string]>([
    '/images/lehenga-orange-zardosi.jpg',
    '',
    '',
    '',
  ]);
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

  const imageInputRefs = [
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
  ];
  const multiImageInputRef = useRef<HTMLInputElement | null>(null);
  const outfitVideoInputRef = useRef<HTMLInputElement | null>(null);
  const heroVideoInputRef = useRef<HTMLInputElement | null>(null);
  const heroPosterInputRef = useRef<HTMLInputElement | null>(null);
  const topLogoInputRef = useRef<HTMLInputElement | null>(null);
  const bottomLogoInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 4500);
  };

  // Upload helper that saves file to /uploads on the backend and returns a clean URL
  const uploadFileToBackend = async (file: File, prefix: string): Promise<string> => {
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
  };

  const handleImageSlotChange = (index: number, val: string) => {
    setImageSlots((prev) => {
      const next = [...prev] as [string, string, string, string];
      next[index] = val;
      return next;
    });
  };

  const handleSingleImageUpload = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSlot(`img-${index}`);
    try {
      const uploadedUrl = await uploadFileToBackend(file, `lehenga-img-${index + 1}`);
      handleImageSlotChange(index, uploadedUrl);
      showToast(`Uploaded Image ${index + 1} for lehenga.`);
    } finally {
      setUploadingSlot(null);
      e.target.value = '';
    }
  };

  const handleBatchImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 4);
    if (files.length === 0) return;
    setUploadingSlot('batch-img');
    try {
      const uploadedUrls = await Promise.all(
        files.map((file, idx) => uploadFileToBackend(file, `lehenga-img-${idx + 1}`))
      );
      setImageSlots((prev) => {
        const next = [...prev] as [string, string, string, string];
        let cursor = 0;
        for (let i = 0; i < 4 && cursor < uploadedUrls.length; i++) {
          if (!next[i] || i < uploadedUrls.length) {
            next[i] = uploadedUrls[cursor++];
          }
        }
        return next;
      });
      showToast(`Uploaded ${uploadedUrls.length} photo(s) for lehenga.`);
    } finally {
      setUploadingSlot(null);
      e.target.value = '';
    }
  };

  const handleOutfitVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSlot('video');
    try {
      const uploadedUrl = await uploadFileToBackend(file, 'lehenga-video');
      setVideoUrl(uploadedUrl);
      showToast('Uploaded twirl video for lehenga.');
    } finally {
      setUploadingSlot(null);
      e.target.value = '';
    }
  };

  // Populate form for editing an existing lehenga
  const startEditingOutfit = (item: LehengaOutfit) => {
    setEditingOutfitId(item.id);
    setTitle(item.title);
    setCode(item.code);
    setPricePerDay(String(item.pricePerDay));
    setVibeCategory(item.vibeCategory);
    setSizesInput(item.sizes.join(', '));
    setDescription(item.description);
    setOgHumorTagline(item.ogHumorTagline);

    const existingImages =
      Array.isArray(item.images) && item.images.length > 0
        ? item.images
        : item.mediaType === 'image' && item.mediaUrl
        ? [item.mediaUrl]
        : [];

    setImageSlots([
      existingImages[0] || '',
      existingImages[1] || '',
      existingImages[2] || '',
      existingImages[3] || '',
    ]);
    setVideoUrl(item.videoUrl || (item.mediaType === 'video' ? item.mediaUrl : ''));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditingOutfit = () => {
    setEditingOutfitId(null);
    setTitle('');
    setCode(`LOL-IND-0${outfits.length + 1}`);
    setPricePerDay('2499');
    setVibeCategory('Sangeet Main Character');
    setImageSlots(['/images/lehenga-orange-zardosi.jpg', '', '', '']);
    setVideoUrl('');
  };

  const handleOutfitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const validImages = imageSlots.map((s) => s.trim()).filter(Boolean).slice(0, 4);
    const cleanVideoUrl = videoUrl.trim();
    const primaryMediaUrl =
      validImages[0] || cleanVideoUrl || '/images/lehenga-orange-zardosi.jpg';
    const primaryMediaType: 'image' | 'video' =
      validImages.length > 0 ? 'image' : cleanVideoUrl ? 'video' : 'image';
    const finalImages =
      validImages.length > 0
        ? validImages
        : primaryMediaType === 'image'
        ? [primaryMediaUrl]
        : [];

    if (editingOutfitId) {
      const existing = outfits.find((o) => o.id === editingOutfitId);
      const updatedOutfit: LehengaOutfit = {
        id: editingOutfitId,
        code: code.trim().toUpperCase() || defaultCode,
        title: title.trim(),
        pricePerDay: Math.max(499, Number(pricePerDay) || 2499),
        description: description.trim(),
        ogHumorTagline: ogHumorTagline.trim(),
        mediaUrl: primaryMediaUrl,
        mediaType: primaryMediaType,
        images: finalImages,
        videoUrl: cleanVideoUrl || undefined,
        vibeCategory: vibeCategory.trim() || 'Sangeet Main Character',
        sizes: sizesInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        available: existing ? existing.available : true,
        createdAt: existing ? existing.createdAt : new Date().toISOString(),
      };
      await onUpdateOutfit(updatedOutfit);
      showToast(`Updated "${updatedOutfit.title}" (${updatedOutfit.code}) — live on store now!`);
      cancelEditingOutfit();
    } else {
      const newOutfit: LehengaOutfit = {
        id: `lol-custom-${Date.now()}`,
        code: code.trim().toUpperCase() || defaultCode,
        title: title.trim(),
        pricePerDay: Math.max(499, Number(pricePerDay) || 2499),
        description: description.trim(),
        ogHumorTagline: ogHumorTagline.trim(),
        mediaUrl: primaryMediaUrl,
        mediaType: primaryMediaType,
        images: finalImages,
        videoUrl: cleanVideoUrl || undefined,
        vibeCategory: vibeCategory.trim() || 'Sangeet Main Character',
        sizes: sizesInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        available: true,
        createdAt: new Date().toISOString(),
      };

      await onAddOutfit(newOutfit);
      showToast(`Published "${newOutfit.title}" (${newOutfit.code}) — live on store now!`);
      setTitle('');
      setCode(`LOL-IND-0${outfits.length + 2}`);
      setImageSlots(['/images/lehenga-orange-zardosi.jpg', '', '', '']);
      setVideoUrl('');
    }
  };

  // Save Banner or Branding Settings to Backend
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

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Backend CMS Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#1C1310]/12">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#E85D24]/15 text-[#E85D24] text-[10px] font-bold uppercase tracking-widest">
              Backend Admin CMS
            </span>
            <span className="text-xs text-[#1C1310]/50 font-mono-num">/admin</span>
          </div>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#1C1310]">
            LOL Studio Backend & Media Manager
          </h1>
          <p className="text-xs text-[#1C1310]/65 mt-1">
            Manage all editable website content—lehenga photos/videos, hero banner video, and top &
            bottom logos—strictly from this backend panel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onBackToCatalog}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1C1310] text-white text-xs font-semibold hover:bg-[#E85D24] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>View Live Customer Website</span>
            <ExternalLink className="w-3 h-3 opacity-75" />
          </button>
        </div>
      </div>

      {/* Section Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1C1310]/10 pb-4">
        <button
          onClick={() => setActiveTab('lehengas')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'lehengas'
              ? 'bg-[#1C1310] text-white shadow-sm'
              : 'bg-white text-[#1C1310]/70 hover:text-[#1C1310] border border-[#1C1310]/10'
          }`}
        >
          <ShoppingBag className="w-4 h-4 text-[#E85D24]" />
          <span>Inventory Management</span>
        </button>

        <button
          onClick={() => setActiveTab('banner')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'banner'
              ? 'bg-[#1C1310] text-white shadow-sm'
              : 'bg-white text-[#1C1310]/70 hover:text-[#1C1310] border border-[#1C1310]/10'
          }`}
        >
          <Film className="w-4 h-4 text-[#E85D24]" />
          <span>Banner Management</span>
        </button>

        <button
          onClick={() => setActiveTab('branding')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'branding'
              ? 'bg-[#1C1310] text-white shadow-sm'
              : 'bg-white text-[#1C1310]/70 hover:text-[#1C1310] border border-[#1C1310]/10'
          }`}
        >
          <Palette className="w-4 h-4 text-[#E85D24]" />
          <span>Logo Management</span>
        </button>
      </div>

      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* TAB 1: LEHENGA COLLECTION MANAGER */}
      {activeTab === 'lehengas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Add or Edit Lehenga Form */}
          <form
            onSubmit={handleOutfitSubmit}
            className="lg:col-span-7 bg-white rounded-2xl p-6 sm:p-8 border border-[#1C1310]/10 shadow-xs space-y-5"
          >
            <div className="flex items-center justify-between border-b border-[#1C1310]/8 pb-4">
              <div>
                <h2 className="font-editorial text-2xl font-semibold text-[#1C1310]">
                  {editingOutfitId ? 'Edit Selected Lehenga' : 'Add New Lehenga to Storefront'}
                </h2>
                <p className="text-[11px] text-[#1C1310]/60">
                  {editingOutfitId
                    ? 'Update the image, video, title, or daily rent below and click Save.'
                    : 'Upload a lehenga photo or twirl video to publish it to the catalog.'}
                </p>
              </div>
              {editingOutfitId ? (
                <button
                  type="button"
                  onClick={cancelEditingOutfit}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel Edit</span>
                </button>
              ) : (
                <span className="text-[11px] font-mono-num text-[#E85D24] font-semibold">
                  SKU: {defaultCode}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70 mb-1.5">
                  Outfit Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., The 'Sangeet Showstopper' Crimson Zardosi"
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310] focus:outline-none focus:bg-white focus:border-[#1C1310]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70 mb-1.5">
                  SKU Code *
                </label>
                <div className="relative">
                  <Tag className="w-3.5 h-3.5 text-[#1C1310]/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs font-mono-num uppercase text-[#1C1310] focus:outline-none focus:bg-white focus:border-[#1C1310]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70 mb-1.5">
                  Rent Per Day (₹) *
                </label>
                <div className="relative">
                  <IndianRupee className="w-3.5 h-3.5 text-[#1C1310]/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    required
                    value={pricePerDay}
                    onChange={(e) => setPricePerDay(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310] focus:outline-none focus:bg-white focus:border-[#1C1310]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70 mb-1.5">
                  Occasion Edit (Fully Customizable) *
                </label>
                <input
                  type="text"
                  required
                  value={vibeCategory}
                  onChange={(e) => setVibeCategory(e.target.value)}
                  placeholder="Type custom occasion (e.g., Sangeet Main Character, Bridal Entry...)"
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310] focus:outline-none focus:bg-white focus:border-[#1C1310]"
                />
              </div>
            </div>

            {/* 4 Lehenga Images + 1 Twirl Video Upload Section */}
            <div className="space-y-4 p-4 rounded-2xl bg-[#FAF8F5] border border-[#1C1310]/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]">
                    Lehenga Media Gallery (Up to 4 Images & 1 Video)
                  </label>
                  <p className="text-[11px] text-[#1C1310]/55">
                    Add up to 4 high-res photos (Image 1 is the primary cover) and 1 optional twirl
                    video.
                  </p>
                </div>

                <div>
                  <input
                    ref={multiImageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleBatchImagesUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => multiImageInputRef.current?.click()}
                    disabled={uploadingSlot !== null}
                    className="px-3 py-1.5 rounded-lg bg-[#1C1310] hover:bg-[#E85D24] text-white text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {uploadingSlot === 'batch-img'
                        ? 'Uploading Photos...'
                        : 'Select Up to 4 Photos'}
                    </span>
                  </button>
                </div>
              </div>

              {/* 4 Image Slots Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((slotIdx) => {
                  const imgUrl = imageSlots[slotIdx];
                  const isUploadingThis = uploadingSlot === `img-${slotIdx}`;
                  return (
                    <div
                      key={slotIdx}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-[#1C1310]/12"
                    >
                      <div className="w-12 h-16 rounded-lg overflow-hidden bg-[#EFECE6] border border-[#1C1310]/10 shrink-0 flex items-center justify-center">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={`Slot ${slotIdx + 1}`}
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-[#1C1310]/30" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1C1310]/70">
                            {slotIdx === 0 ? 'Image 1 (Cover) *' : `Image ${slotIdx + 1}`}
                          </span>
                          {imgUrl && (
                            <button
                              type="button"
                              onClick={() => handleImageSlotChange(slotIdx, '')}
                              className="text-[10px] text-red-600 hover:underline cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>

                        <input
                          type="text"
                          value={imgUrl}
                          onChange={(e) => handleImageSlotChange(slotIdx, e.target.value)}
                          placeholder={`Paste Image ${slotIdx + 1} URL or upload...`}
                          className="w-full px-2.5 py-1.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-lg text-[11px] text-[#1C1310] focus:outline-none focus:bg-white focus:border-[#1C1310]"
                        />

                        <div>
                          <input
                            ref={imageInputRefs[slotIdx]}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleSingleImageUpload(slotIdx, e)}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => imageInputRefs[slotIdx].current?.click()}
                            disabled={uploadingSlot !== null}
                            className="w-full py-1 px-2.5 rounded-lg border border-[#1C1310]/15 bg-[#FAF8F5] hover:bg-white text-[10px] font-semibold text-[#1C1310] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Upload className="w-3 h-3 text-[#E85D24]" />
                            <span>
                              {isUploadingThis ? 'Uploading...' : `Upload Image ${slotIdx + 1}`}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 1 Video Slot */}
              <div className="pt-2 border-t border-[#1C1310]/10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl bg-white border border-[#1C1310]/12">
                  <div className="w-14 h-18 rounded-lg overflow-hidden bg-[#1C1310] border border-[#1C1310]/15 shrink-0 flex items-center justify-center">
                    {videoUrl ? (
                      <video
                        src={videoUrl}
                        className="w-full h-full object-cover"
                        muted
                        loop
                        autoPlay
                        playsInline
                      />
                    ) : (
                      <Film className="w-5 h-5 text-[#E85D24]" />
                    )}
                  </div>

                  <div className="flex-1 w-full space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1C1310]/75 flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-[#E85D24]" />
                        <span>1 Lehenga Video (Twirl / Reel MP4 or WebM)</span>
                      </span>
                      {videoUrl && (
                        <button
                          type="button"
                          onClick={() => setVideoUrl('')}
                          className="text-[10px] text-red-600 hover:underline cursor-pointer"
                        >
                          Remove Video
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="Paste video URL (.mp4 / .webm) or click Upload Video..."
                        className="flex-1 px-3 py-2 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-lg text-xs text-[#1C1310] focus:outline-none focus:bg-white focus:border-[#1C1310]"
                      />
                      <input
                        ref={outfitVideoInputRef}
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,video/*"
                        onChange={handleOutfitVideoUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => outfitVideoInputRef.current?.click()}
                        disabled={uploadingSlot !== null}
                        className="px-3.5 py-2 rounded-lg border border-[#1C1310]/15 bg-[#FAF8F5] hover:bg-white text-xs font-semibold text-[#1C1310] inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#E85D24]" />
                        <span>
                          {uploadingSlot === 'video' ? 'Uploading Video...' : 'Upload 1 Video'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Copy Templates */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70">
                  Description & Styling Note
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {HUMOR_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => {
                        setDescription(tpl.description);
                        setOgHumorTagline(tpl.ogTagline);
                      }}
                      className="px-2.5 py-1 rounded-md bg-[#FAF8F5] hover:bg-[#1C1310] hover:text-white text-[10px] font-medium text-[#1C1310]/75 transition-colors cursor-pointer"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310] focus:outline-none focus:bg-white focus:border-[#1C1310]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70 mb-1.5">
                Available Sizes (comma separated)
              </label>
              <input
                type="text"
                value={sizesInput}
                onChange={(e) => setSizesInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-xl bg-[#1C1310] text-white text-xs uppercase tracking-[0.16em] font-semibold hover:bg-[#E85D24] transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {editingOutfitId ? (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes to Lehenga</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Publish Lehenga to Storefront</span>
                </>
              )}
            </button>
          </form>

          {/* Right: Active Catalog List with Edit & Delete */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-[#1C1310]/10 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#1C1310]/8 pb-3">
              <div>
                <h3 className="font-editorial text-2xl font-semibold text-[#1C1310]">
                  Live Lehengas ({outfits.length})
                </h3>
                <p className="text-[11px] text-[#1C1310]/55">
                  Click the pencil icon on any lehenga to edit its 4 photos, video, occasion, or
                  price.
                </p>
              </div>
            </div>

            <div className="space-y-3 max-h-[560px] overflow-y-auto luxury-scroll pr-1">
              {outfits.map((item) => {
                const imgCount =
                  Array.isArray(item.images) && item.images.length > 0
                    ? item.images.length
                    : item.mediaType === 'image'
                    ? 1
                    : 0;
                const hasVideo = Boolean(item.videoUrl || item.mediaType === 'video');
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3.5 p-3 rounded-xl border transition-colors ${
                      editingOutfitId === item.id
                        ? 'bg-[#FFF5EE] border-[#E85D24]'
                        : 'bg-[#FAF8F5] border-[#1C1310]/8'
                    }`}
                  >
                    {item.mediaType === 'video' && (!item.images || item.images.length === 0) ? (
                      <video
                        src={item.videoUrl || item.mediaUrl}
                        className="w-14 h-18 rounded-lg object-cover bg-[#EFECE6] shrink-0"
                        muted
                      />
                    ) : (
                      <img
                        src={(item.images && item.images[0]) || item.mediaUrl}
                        alt={item.title}
                        className="w-14 h-18 rounded-lg object-cover object-top bg-[#EFECE6] shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono-num font-semibold text-[#E85D24]">
                          {item.code}
                        </span>
                        <span className="text-[10px] text-[#1C1310]/50 truncate">
                          • {item.vibeCategory}
                        </span>
                      </div>
                      <h4 className="font-editorial text-lg font-semibold text-[#1C1310] truncate">
                        {item.title}
                      </h4>
                      <p className="text-xs text-[#1C1310]/65">
                        ₹{item.pricePerDay.toLocaleString('en-IN')}/day •{' '}
                        <span className="text-[10px] text-[#1C1310]/50">
                          {imgCount} photo{imgCount === 1 ? '' : 's'}
                          {hasVideo ? ' + 1 video' : ''}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEditingOutfit(item)}
                        title="Edit lehenga photo/details"
                        className="p-2 rounded-lg text-[#1C1310]/65 hover:text-[#E85D24] hover:bg-white transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteOutfit(item.id)}
                        title="Remove outfit"
                        className="p-2 rounded-lg text-[#1C1310]/45 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HERO BANNER VIDEO & IMAGE MANAGER */}
      {activeTab === 'banner' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 bg-white rounded-2xl p-6 sm:p-8 border border-[#1C1310]/10 shadow-xs space-y-6">
            <div className="border-b border-[#1C1310]/8 pb-4">
              <h2 className="font-editorial text-2xl font-semibold text-[#1C1310]">
                Hero Banner Video & Image Settings
              </h2>
              <p className="text-xs text-[#1C1310]/60 mt-1">
                Upload your muted looping `.mp4` banner video or static banner image here. Customers
                will only see the clean full-screen banner on the frontend.
              </p>
            </div>

            {/* Banner Type Switcher */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70 mb-2">
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
                      ? 'bg-[#1C1310] text-white border-[#1C1310]'
                      : 'bg-[#FAF8F5] text-[#1C1310]/70 border-[#1C1310]/15'
                  }`}
                >
                  <Film className="w-4 h-4 text-[#E85D24]" />
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
                      ? 'bg-[#1C1310] text-white border-[#1C1310]'
                      : 'bg-[#FAF8F5] text-[#1C1310]/70 border-[#1C1310]/15'
                  }`}
                >
                  <ImageIcon className="w-4 h-4 text-[#E85D24]" />
                  <span>Static Image Banner</span>
                </button>
              </div>
            </div>

            {/* Upload Hero Video (.mp4) */}
            <div className="space-y-2 pt-2 border-t border-[#1C1310]/8">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70">
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
                  className="flex-1 px-3.5 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310]"
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
                  className="px-4 py-2.5 rounded-xl bg-[#E85D24] hover:bg-[#d14e17] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isSavingSettings ? 'Uploading...' : 'Upload MP4 Video'}</span>
                </button>
              </div>
            </div>

            {/* Upload Hero Poster / Static Banner Image */}
            <div className="space-y-2 pt-2 border-t border-[#1C1310]/8">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70">
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
                  className="flex-1 px-3.5 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310]"
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
                  className="px-4 py-2.5 rounded-xl border border-[#1C1310]/15 bg-[#FAF8F5] hover:bg-white text-xs font-semibold text-[#1C1310] inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Upload className="w-3.5 h-3.5 text-[#E85D24]" />
                  <span>Upload Banner Image</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                handleSaveSettings(draftSettings, 'Saved Hero Banner settings to live storefront!')
              }
              className="w-full py-3.5 px-6 rounded-xl bg-[#1C1310] text-white text-xs uppercase tracking-[0.16em] font-semibold hover:bg-[#E85D24] transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Banner Settings</span>
            </button>
          </div>

          {/* Right: Live Preview of Hero Banner */}
          <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-[#1C1310]/10 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-editorial text-2xl font-semibold text-[#1C1310]">
                Live Hero Banner Preview
              </h3>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#E85D24]">
                {draftSettings.heroMediaType === 'video' ? 'Playing Video Loop' : 'Static Image'}
              </span>
            </div>
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#2B180A] border border-[#1C1310]/15">
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
          <div className="lg:col-span-7 bg-white rounded-2xl p-6 sm:p-8 border border-[#1C1310]/10 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-[#1C1310]/8 pb-4">
              <div>
                <h2 className="font-editorial text-2xl font-semibold text-[#1C1310]">
                  Top & Bottom Logos & Studio Identity
                </h2>
                <p className="text-xs text-[#1C1310]/60 mt-1">
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
                className="text-xs text-[#1C1310]/60 hover:text-[#1C1310] underline cursor-pointer"
              >
                Reset Defaults
              </button>
            </div>

            {/* Top Navbar Logo Upload */}
            <div className="space-y-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70">
                Top Navbar Logo Image (Leave empty to use Gold Text Lockup `लोल | LOL COUTURE`)
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={draftSettings.topLogoUrl}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, topLogoUrl: e.target.value })
                  }
                  placeholder="Upload custom top logo PNG/SVG or leave empty for default..."
                  className="flex-1 px-3.5 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310]"
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
                  className="px-4 py-2.5 rounded-xl border border-[#1C1310]/15 bg-[#FAF8F5] hover:bg-white text-xs font-semibold text-[#1C1310] inline-flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <Upload className="w-3.5 h-3.5 text-[#E85D24]" />
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

              {/* Top Logo Size Slider & Presets */}
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#1C1310]/10 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/75">
                    Top Logo Size (Height):{' '}
                    <strong className="text-[#E85D24] font-mono-num">
                      {draftSettings.topLogoHeight || 56}px
                    </strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: 'S (36px)', val: 36 },
                      { label: 'M (56px)', val: 56 },
                      { label: 'L (76px)', val: 76 },
                      { label: 'XL (100px)', val: 100 },
                    ].map((preset) => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() =>
                          setDraftSettings({ ...draftSettings, topLogoHeight: preset.val })
                        }
                        className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                          (draftSettings.topLogoHeight || 56) === preset.val
                            ? 'bg-[#1C1310] text-white'
                            : 'bg-white text-[#1C1310]/70 border border-[#1C1310]/12 hover:text-[#1C1310]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
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
                    className="flex-1 accent-[#E85D24] cursor-pointer"
                  />
                  <input
                    type="number"
                    min={20}
                    max={200}
                    value={draftSettings.topLogoHeight || 56}
                    onChange={(e) =>
                      setDraftSettings({
                        ...draftSettings,
                        topLogoHeight: Math.max(20, Math.min(200, Number(e.target.value) || 56)),
                      })
                    }
                    className="w-16 px-2 py-1 bg-white border border-[#1C1310]/15 rounded-lg text-xs font-mono-num text-center text-[#1C1310]"
                  />
                </div>
              </div>
            </div>

            {/* Top Brand Text Lockup Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70 mb-1.5">
                  Hindi / Emblem Mark
                </label>
                <input
                  type="text"
                  value={draftSettings.brandHindiMark}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, brandHindiMark: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70 mb-1.5">
                  Top Brand Title
                </label>
                <input
                  type="text"
                  value={draftSettings.brandTitle}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, brandTitle: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70 mb-1.5">
                  Top Brand Subtitle
                </label>
                <input
                  type="text"
                  value={draftSettings.brandSubtitle}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, brandSubtitle: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310]"
                />
              </div>
            </div>

            {/* Bottom Footer Logo Upload */}
            <div className="space-y-3 pt-3 border-t border-[#1C1310]/8">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70">
                Bottom Footer Logo Image (Leave empty to use Official LOL By Sanjeevani Vector Logo)
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={draftSettings.bottomLogoUrl}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, bottomLogoUrl: e.target.value })
                  }
                  placeholder="Upload custom bottom footer logo or leave empty for official vector logo..."
                  className="flex-1 px-3.5 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310]"
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
                  className="px-4 py-2.5 rounded-xl border border-[#1C1310]/15 bg-[#FAF8F5] hover:bg-white text-xs font-semibold text-[#1C1310] inline-flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <Upload className="w-3.5 h-3.5 text-[#E85D24]" />
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

              {/* Bottom Logo Size Slider & Presets */}
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#1C1310]/10 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/75">
                    Bottom Logo Size (Height):{' '}
                    <strong className="text-[#E85D24] font-mono-num">
                      {draftSettings.bottomLogoHeight || 88}px
                    </strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: 'S (56px)', val: 56 },
                      { label: 'M (88px)', val: 88 },
                      { label: 'L (120px)', val: 120 },
                      { label: 'XL (160px)', val: 160 },
                    ].map((preset) => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() =>
                          setDraftSettings({ ...draftSettings, bottomLogoHeight: preset.val })
                        }
                        className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                          (draftSettings.bottomLogoHeight || 88) === preset.val
                            ? 'bg-[#1C1310] text-white'
                            : 'bg-white text-[#1C1310]/70 border border-[#1C1310]/12 hover:text-[#1C1310]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={36}
                    max={200}
                    step={2}
                    value={draftSettings.bottomLogoHeight || 88}
                    onChange={(e) =>
                      setDraftSettings({
                        ...draftSettings,
                        bottomLogoHeight: Number(e.target.value),
                      })
                    }
                    className="flex-1 accent-[#E85D24] cursor-pointer"
                  />
                  <input
                    type="number"
                    min={30}
                    max={260}
                    value={draftSettings.bottomLogoHeight || 88}
                    onChange={(e) =>
                      setDraftSettings({
                        ...draftSettings,
                        bottomLogoHeight: Math.max(30, Math.min(260, Number(e.target.value) || 88)),
                      })
                    }
                    className="w-16 px-2 py-1 bg-white border border-[#1C1310]/15 rounded-lg text-xs font-mono-num text-center text-[#1C1310]"
                  />
                </div>
              </div>
            </div>

            {/* Footer Bio, Location & WhatsApp */}
            <div className="space-y-3 pt-3 border-t border-[#1C1310]/8">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70 mb-1.5">
                  Footer Brand Description
                </label>
                <textarea
                  rows={2}
                  value={draftSettings.footerDescription}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, footerDescription: e.target.value })
                  }
                  className="w-full p-3 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70 mb-1.5">
                    Studio Address / Location
                  </label>
                  <input
                    type="text"
                    value={draftSettings.studioLocation}
                    onChange={(e) =>
                      setDraftSettings({ ...draftSettings, studioLocation: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70 mb-1.5">
                    WhatsApp Concierge Number
                  </label>
                  <input
                    type="text"
                    value={draftSettings.whatsappNumber}
                    onChange={(e) =>
                      setDraftSettings({ ...draftSettings, whatsappNumber: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310]"
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
              className="w-full py-3.5 px-6 rounded-xl bg-[#1C1310] text-white text-xs uppercase tracking-[0.16em] font-semibold hover:bg-[#E85D24] transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Branding & Logos</span>
            </button>
          </div>

          {/* Right: Live Preview of Top & Bottom Logos */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#1C1310] rounded-2xl p-6 text-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-[#F5A623] font-semibold">
                  Top Navbar Logo Preview
                </span>
                <span className="text-[10px] font-mono-num text-white/60">
                  Height: {draftSettings.topLogoHeight || 56}px
                </span>
              </div>
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 flex items-center gap-3 overflow-hidden">
                {draftSettings.topLogoUrl ? (
                  <img
                    src={draftSettings.topLogoUrl}
                    alt="Top Logo Preview"
                    style={{ height: `${draftSettings.topLogoHeight || 56}px` }}
                    className="w-auto object-contain transition-all duration-150"
                  />
                ) : (
                  <div
                    className="flex items-center gap-2.5 origin-left transition-transform duration-150"
                    style={{
                      transform: `scale(${(draftSettings.topLogoHeight || 56) / 48})`,
                    }}
                  >
                    <span
                      className="text-3xl font-bold tracking-tight text-[#F5A623]"
                      style={{ fontFamily: "'Oswald', sans-serif" }}
                    >
                      {draftSettings.brandHindiMark || 'लोल'}
                    </span>
                    <span className="h-6 w-[1.5px] bg-[#F5A623]/70" />
                    <div className="flex flex-col">
                      <span
                        className="text-2xl font-bold tracking-[0.14em] text-[#F5A623] leading-none"
                        style={{ fontFamily: "'Oswald', sans-serif" }}
                      >
                        {draftSettings.brandTitle || 'LOL COUTURE'}
                      </span>
                      <span className="text-[9px] tracking-[0.22em] uppercase text-white/80 mt-0.5">
                        {draftSettings.brandSubtitle || 'By Sanjeevani • Indore'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#1C1310] rounded-2xl p-6 text-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-[#F5A623] font-semibold">
                  Bottom Footer Logo Preview
                </span>
                <span className="text-[10px] font-mono-num text-white/60">
                  Height: {draftSettings.bottomLogoHeight || 88}px
                </span>
              </div>
              <div className="p-5 rounded-xl bg-white/95 text-[#1C1310] flex flex-col items-center justify-center overflow-hidden">
                {draftSettings.bottomLogoUrl ? (
                  <img
                    src={draftSettings.bottomLogoUrl}
                    alt="Bottom Logo Preview"
                    style={{ height: `${draftSettings.bottomLogoHeight || 88}px` }}
                    className="w-auto object-contain transition-all duration-150"
                  />
                ) : (
                  <div
                    className="transition-transform duration-150"
                    style={{
                      transform: `scale(${(draftSettings.bottomLogoHeight || 88) / 88})`,
                    }}
                  >
                    <LolBrandLogo variant="full" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
