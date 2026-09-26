import React, { useState, useRef } from 'react';
import {
  Plus,
  Trash2,
  Upload,
  Sparkles,
  Tag,
  IndianRupee,
  RotateCcw,
  CheckCircle2,
  MapPin,
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
import { LehengaOutfit, VibeCategory, SiteSettings, DEFAULT_SITE_SETTINGS } from '../types';
import { LolBrandLogo } from './LolBrandLogo';

interface AdminDashboardProps {
  outfits: LehengaOutfit[];
  siteSettings: SiteSettings;
  onUpdateSiteSettings: (settings: SiteSettings) => Promise<void> | void;
  onAddOutfit: (outfit: LehengaOutfit) => void;
  onUpdateOutfit: (outfit: LehengaOutfit) => void;
  onDeleteOutfit: (id: string) => void;
  onResetCatalog: () => void;
  onBackToCatalog: () => void;
}

const VIBE_OPTIONS: Exclude<VibeCategory, 'All Vibes'>[] = [
  'Sangeet Main Character',
  'Ex-Cousin Wedding',
  'Haldi & Sundowner',
  'Cocktail Slay',
  'Reception Royalty',
];

const HUMOR_TEMPLATES = [
  {
    label: 'Bua-Ji Distractor',
    description:
      "So blindingly gorgeous that relatives will forget to ask 'Beta, aage kya plan hai?' Pure raw silk with antique gold zardosi. Zero storage trauma, 100% Instagram feed dominance.",
    ogTagline:
      'Why spend ₹60,000 when you can break Instagram for ₹2,499/day? Rent it, flex it, return it tomorrow. 🔥',
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
  onResetCatalog,
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
  const [retailPrice, setRetailPrice] = useState('55000');
  const [vibeCategory, setVibeCategory] =
    useState<Exclude<VibeCategory, 'All Vibes'>>('Sangeet Main Character');
  const [indoreHotspot, setIndoreHotspot] = useState('Sayaji & Sheraton Grand Sangeets');
  const [sizesInput, setSizesInput] = useState('XS-S, M-L');
  const [description, setDescription] = useState(HUMOR_TEMPLATES[0].description);
  const [ogHumorTagline, setOgHumorTagline] = useState(HUMOR_TEMPLATES[0].ogTagline);
  const [mediaUrl, setMediaUrl] = useState('/images/lehenga-orange-zardosi.jpg');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');

  const outfitFileInputRef = useRef<HTMLInputElement | null>(null);
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

  // Handle Lehenga Image/Video File Upload
  const handleOutfitFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    setIsSavingSettings(true);
    try {
      const uploadedUrl = await uploadFileToBackend(file, 'lehenga');
      setMediaUrl(uploadedUrl);
      setMediaType(isVideo ? 'video' : 'image');
      showToast(`Uploaded ${isVideo ? 'video' : 'photo'} for lehenga.`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Populate form for editing an existing lehenga
  const startEditingOutfit = (item: LehengaOutfit) => {
    setEditingOutfitId(item.id);
    setTitle(item.title);
    setCode(item.code);
    setPricePerDay(String(item.pricePerDay));
    setRetailPrice(String(item.retailPrice));
    setVibeCategory(item.vibeCategory);
    setIndoreHotspot(item.indoreHotspot);
    setSizesInput(item.sizes.join(', '));
    setDescription(item.description);
    setOgHumorTagline(item.ogHumorTagline);
    setMediaUrl(item.mediaUrl);
    setMediaType(item.mediaType);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditingOutfit = () => {
    setEditingOutfitId(null);
    setTitle('');
    setCode(`LOL-IND-0${outfits.length + 1}`);
    setPricePerDay('2499');
    setRetailPrice('55000');
    setMediaUrl('/images/lehenga-orange-zardosi.jpg');
    setMediaType('image');
  };

  const handleOutfitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingOutfitId) {
      const existing = outfits.find((o) => o.id === editingOutfitId);
      const updatedOutfit: LehengaOutfit = {
        id: editingOutfitId,
        code: code.trim().toUpperCase() || defaultCode,
        title: title.trim(),
        pricePerDay: Math.max(499, Number(pricePerDay) || 2499),
        retailPrice: Math.max(5000, Number(retailPrice) || 55000),
        description: description.trim(),
        ogHumorTagline: ogHumorTagline.trim(),
        mediaUrl: mediaUrl.trim() || '/images/lehenga-orange-zardosi.jpg',
        mediaType,
        vibeCategory,
        sizes: sizesInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        indoreHotspot: indoreHotspot.trim() || 'Indore Bridal & Sangeet Approved',
        available: existing ? existing.available : true,
        createdAt: existing ? existing.createdAt : new Date().toISOString(),
      };
      onUpdateOutfit(updatedOutfit);
      showToast(`Updated "${updatedOutfit.title}" (${updatedOutfit.code}) on live storefront.`);
      cancelEditingOutfit();
    } else {
      const newOutfit: LehengaOutfit = {
        id: `lol-custom-${Date.now()}`,
        code: code.trim().toUpperCase() || defaultCode,
        title: title.trim(),
        pricePerDay: Math.max(499, Number(pricePerDay) || 2499),
        retailPrice: Math.max(5000, Number(retailPrice) || 55000),
        description: description.trim(),
        ogHumorTagline: ogHumorTagline.trim(),
        mediaUrl: mediaUrl.trim() || '/images/lehenga-orange-zardosi.jpg',
        mediaType,
        vibeCategory,
        sizes: sizesInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        indoreHotspot: indoreHotspot.trim() || 'Indore Bridal & Sangeet Approved',
        available: true,
        createdAt: new Date().toISOString(),
      };

      onAddOutfit(newOutfit);
      showToast(`Published "${newOutfit.title}" (${newOutfit.code}) to live storefront.`);
      setTitle('');
      setCode(`LOL-IND-0${outfits.length + 2}`);
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
          <span>1. Lehenga Collection & Photos/Videos ({outfits.length})</span>
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
          <span>2. Hero Video & Banner Manager</span>
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
          <span>3. Top & Bottom Logos & Studio Info</span>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  Boutique MRP (₹) *
                </label>
                <input
                  type="number"
                  required
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310] focus:outline-none focus:bg-white focus:border-[#1C1310]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70 mb-1.5">
                  Occasion Edit
                </label>
                <select
                  value={vibeCategory}
                  onChange={(e) =>
                    setVibeCategory(e.target.value as Exclude<VibeCategory, 'All Vibes'>)
                  }
                  className="w-full px-3 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310] focus:outline-none focus:bg-white focus:border-[#1C1310]"
                >
                  {VIBE_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lehenga Photo or Video Upload */}
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70">
                Lehenga Photo or Twirl Video
              </label>
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="w-16 h-20 rounded-xl overflow-hidden bg-[#FAF8F5] border border-[#1C1310]/15 shrink-0">
                  {mediaType === 'video' ? (
                    <video src={mediaUrl} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                  ) : (
                    <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover object-top" />
                  )}
                </div>
                <div className="flex-1 w-full space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder="Paste image/video URL or click Upload File..."
                      className="flex-1 px-3.5 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310] focus:outline-none focus:bg-white focus:border-[#1C1310]"
                    />
                    <input
                      ref={outfitFileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleOutfitFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => outfitFileInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-xl border border-[#1C1310]/15 bg-[#FAF8F5] hover:bg-white text-xs font-semibold text-[#1C1310] inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#E85D24]" />
                      <span>Upload Photo / Video</span>
                    </button>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70 mb-1.5">
                  Indore Venue Recommendation
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-[#1C1310]/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={indoreHotspot}
                    onChange={(e) => setIndoreHotspot(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310]"
                  />
                </div>
              </div>
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
                  Click the pencil icon on any lehenga to change its photo, video, or price.
                </p>
              </div>
              <button
                onClick={onResetCatalog}
                title="Reset to default collection"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#1C1310]/12 text-[11px] text-[#1C1310]/70 hover:text-[#1C1310] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[560px] overflow-y-auto luxury-scroll pr-1">
              {outfits.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3.5 p-3 rounded-xl border transition-colors ${
                    editingOutfitId === item.id
                      ? 'bg-[#FFF5EE] border-[#E85D24]'
                      : 'bg-[#FAF8F5] border-[#1C1310]/8'
                  }`}
                >
                  <img
                    src={item.mediaUrl}
                    alt={item.title}
                    className="w-14 h-18 rounded-lg object-cover object-top bg-[#EFECE6] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-mono-num font-semibold text-[#E85D24]">
                      {item.code}
                    </span>
                    <h4 className="font-editorial text-lg font-semibold text-[#1C1310] truncate">
                      {item.title}
                    </h4>
                    <p className="text-xs text-[#1C1310]/65">
                      ₹{item.pricePerDay.toLocaleString('en-IN')}/day •{' '}
                      <span className="line-through text-[#1C1310]/40">
                        ₹{item.retailPrice.toLocaleString('en-IN')}
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
              ))}
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
            <div className="space-y-2">
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
            <div className="space-y-2 pt-3 border-t border-[#1C1310]/8">
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
              <span className="text-[10px] uppercase tracking-widest text-[#F5A623] font-semibold block">
                Top Navbar Logo Preview
              </span>
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 flex items-center gap-3">
                {draftSettings.topLogoUrl ? (
                  <img
                    src={draftSettings.topLogoUrl}
                    alt="Top Logo Preview"
                    className="h-12 w-auto object-contain"
                  />
                ) : (
                  <div className="flex items-center gap-2.5">
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
              <span className="text-[10px] uppercase tracking-widest text-[#F5A623] font-semibold block">
                Bottom Footer Logo Preview
              </span>
              <div className="p-5 rounded-xl bg-white/95 text-[#1C1310] flex flex-col items-center justify-center">
                {draftSettings.bottomLogoUrl ? (
                  <img
                    src={draftSettings.bottomLogoUrl}
                    alt="Bottom Logo Preview"
                    className="h-24 w-auto object-contain"
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
