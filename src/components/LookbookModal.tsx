import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Heart,
  Share2,
  Sparkles,
  Ruler,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Film,
} from 'lucide-react';
import { LehengaOutfit } from '../types';
import { ProductCard } from './ProductCard';

interface LookbookModalProps {
  outfit: LehengaOutfit | null;
  allOutfits?: LehengaOutfit[];
  wishlist?: string[];
  onClose: () => void;
  onSelectOutfit?: (outfit: LehengaOutfit) => void;
  onRent: (outfit: LehengaOutfit) => void;
  onShare: (outfit: LehengaOutfit) => void;
  isWishlisted: boolean;
  onToggleWishlist: (id: string) => void;
}

export const LookbookModal: React.FC<LookbookModalProps> = ({
  outfit,
  allOutfits = [],
  wishlist = [],
  onClose,
  onSelectOutfit,
  onRent,
  onShare,
  isWishlisted,
  onToggleWishlist,
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 35 });
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);

  useEffect(() => {
    setIsZoomed(false);
    setZoomOrigin({ x: 50, y: 35 });
    setSelectedSize('');
    setActiveMediaIdx(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [outfit?.id]);

  const mediaGallery = useMemo(() => {
    if (!outfit) return [];
    const list: { type: 'image' | 'video'; url: string; label: string }[] = [];
    const imgs =
      Array.isArray(outfit.images) && outfit.images.length > 0
        ? outfit.images.filter(Boolean).slice(0, 4)
        : outfit.mediaType === 'image' && outfit.mediaUrl
        ? [outfit.mediaUrl]
        : [];

    imgs.forEach((url, idx) => {
      list.push({ type: 'image', url, label: `Image ${idx + 1}` });
    });

    const vid = outfit.videoUrl || (outfit.mediaType === 'video' ? outfit.mediaUrl : '');
    if (vid) {
      list.push({ type: 'video', url: vid, label: 'Twirl Video' });
    }

    if (list.length === 0) {
      list.push({
        type: 'image',
        url: outfit.mediaUrl || '/images/lehenga-orange-zardosi.jpg',
        label: 'Image 1',
      });
    }
    return list;
  }, [outfit]);

  if (!outfit) return null;

  const currentMedia = mediaGallery[activeMediaIdx] || mediaGallery[0];
  const currentSize = selectedSize || outfit.sizes[0] || 'M';

  const relatedOutfits = allOutfits
    .filter((item) => item.id !== outfit.id)
    .slice(0, 3);

  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  };

  return (
    <div className="min-h-screen pt-20 pb-20 bg-gradient-to-b from-[#FFF5F8] via-white to-[#FFF0F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Breadcrumb Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-4 mb-6 border-b border-[#F8BBD0]/70">
          <div className="flex items-center gap-2 text-xs text-[#4A1525]/75">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-[#F8BBD0] text-[#4A1525] font-semibold hover:bg-[#FFF0F5] hover:text-[#D81B60] transition-colors cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Collection</span>
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-[#4A1525]/35 hidden sm:block" />
            <span className="hidden sm:inline text-[#4A1525]/60">{outfit.vibeCategory}</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#4A1525]/35 hidden sm:block" />
            <span className="hidden sm:inline font-mono-num font-semibold text-[#D81B60]">
              {outfit.code}
            </span>
          </div>
        </div>

        {/* Full-Page Luxury Card */}
        <div className="w-full bg-white rounded-3xl overflow-hidden shadow-[0_24px_60px_-15px_rgba(216,27,96,0.12)] border border-[#F8BBD0]/80 grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Full-Bleed Portrait with Gallery Thumbnails & Floating + Magnifying Glass Zoom */}
          <div
            onMouseMove={handleImageMouseMove}
            onClick={() => {
              if (currentMedia.type === 'image') {
                setIsZoomed((prev) => !prev);
              }
            }}
            className={`lg:col-span-6 bg-[#FFF0F5] relative flex flex-col justify-between min-h-[460px] sm:min-h-[600px] lg:min-h-[720px] overflow-hidden ${
              currentMedia.type === 'image'
                ? isZoomed
                  ? 'cursor-zoom-out'
                  : 'cursor-zoom-in'
                : ''
            }`}
          >
            {currentMedia.type === 'video' ? (
              <video
                key={currentMedia.url}
                src={currentMedia.url}
                className="w-full h-full object-cover object-top"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img
                src={currentMedia.url}
                alt={outfit.title}
                style={{
                  transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                }}
                className={`w-full h-full object-cover object-top transition-transform duration-300 ease-out ${
                  isZoomed ? 'scale-[2]' : 'scale-100'
                }`}
              />
            )}

            {/* Gallery Thumbnails (4 Images + 1 Video) */}
            {mediaGallery.length > 1 && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-5 left-5 z-20 flex items-center gap-2 bg-white/90 backdrop-blur-md p-1.5 rounded-2xl border border-[#F8BBD0] shadow-md"
              >
                {mediaGallery.map((item, idx) => (
                  <button
                    key={`${item.label}-${idx}`}
                    type="button"
                    onClick={() => {
                      setActiveMediaIdx(idx);
                      setIsZoomed(false);
                    }}
                    title={item.label}
                    className={`relative w-11 h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                      activeMediaIdx === idx
                        ? 'border-[#D81B60] scale-105 shadow-xs'
                        : 'border-transparent opacity-75 hover:opacity-100'
                    }`}
                  >
                    {item.type === 'video' ? (
                      <div className="w-full h-full bg-[#4A1525] flex flex-col items-center justify-center text-white">
                        <Film className="w-4 h-4 text-[#F48FB1]" />
                        <span className="text-[8px] uppercase font-bold mt-0.5">Video</span>
                      </div>
                    ) : (
                      <img
                        src={item.url}
                        alt={item.label}
                        className="w-full h-full object-cover object-top"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Floating + Magnifying Glass Button */}
            {currentMedia.type === 'image' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsZoomed((prev) => !prev);
                }}
                aria-label={isZoomed ? 'Zoom out image' : 'Zoom in image'}
                title={isZoomed ? 'Zoom Out' : 'Zoom In'}
                className="absolute bottom-5 right-5 z-20 w-12 h-12 rounded-full bg-white/95 backdrop-blur-md border border-[#F8BBD0] shadow-lg flex items-center justify-center text-[#4A1525] hover:bg-[#D81B60] hover:text-white hover:border-[#D81B60] transition-all cursor-pointer"
              >
                {isZoomed ? (
                  <ZoomOut className="w-5 h-5" />
                ) : (
                  <ZoomIn className="w-5 h-5" />
                )}
              </button>
            )}
          </div>

          {/* Right Column: Full-Page Luxury Editorial Details */}
          <div className="lg:col-span-6 p-6 sm:p-10 lg:p-12 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Category & Wishlist */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-[#D81B60] font-semibold">
                  {outfit.vibeCategory}
                </span>
                <button
                  onClick={() => onToggleWishlist(outfit.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FFF0F5] border border-[#F8BBD0] text-xs font-semibold text-[#4A1525] hover:text-[#D81B60] transition-colors cursor-pointer"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      isWishlisted ? 'fill-[#D81B60] text-[#D81B60]' : 'text-[#4A1525]/70'
                    }`}
                  />
                  <span>{isWishlisted ? 'Saved' : 'Save'}</span>
                </button>
              </div>

              {/* Title & Pricing */}
              <div>
                <h1 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#4A1525] leading-tight">
                  {outfit.title}
                </h1>

                <div className="mt-4 flex items-baseline gap-3 flex-wrap">
                  <span className="text-3xl sm:text-4xl font-semibold text-[#4A1525]">
                    ₹{outfit.pricePerDay.toLocaleString('en-IN')}
                    <span className="text-sm font-normal text-[#4A1525]/60"> / day rental</span>
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm sm:text-base text-[#4A1525]/80 leading-relaxed">
                {outfit.description}
              </p>

              {/* Size Selection */}
              <div className="pt-5 border-t border-[#F8BBD0]/60">
                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="font-semibold uppercase tracking-wider text-[#4A1525] flex items-center gap-1.5">
                    <Ruler className="w-4 h-4 text-[#D81B60]" />
                    Select Size
                  </span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {outfit.sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`px-5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        currentSize === size
                          ? 'border-[#4A1525] bg-[#4A1525] text-white shadow-xs'
                          : 'border-[#F8BBD0] bg-[#FFF0F5]/60 text-[#4A1525] hover:border-[#D81B60]'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-8 mt-8 border-t border-[#F8BBD0]/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <button
                type="button"
                onClick={() => onShare(outfit)}
                className="px-5 py-4 rounded-2xl border border-[#F8BBD0] bg-white text-xs font-semibold text-[#4A1525] hover:bg-[#FFF0F5] hover:text-[#D81B60] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={() => onRent(outfit)}
                className="flex-1 py-4 px-6 rounded-2xl bg-[#4A1525] text-white text-xs uppercase tracking-[0.16em] font-semibold hover:bg-[#D81B60] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>Reserve This Lehenga</span>
              </button>
            </div>
          </div>
        </div>

        {/* Related Outfits Section */}
        {relatedOutfits.length > 0 && onSelectOutfit && (
          <div className="mt-16 pt-12 border-t border-[#F8BBD0]/60">
            <div className="flex items-center justify-between mb-8">
              <div>
                <span className="text-[11px] uppercase tracking-[0.22em] text-[#D81B60] font-semibold block">
                  More Main-Character Fits
                </span>
                <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#4A1525] mt-1">
                  You Might Also Slay In
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-[#D81B60] hover:underline cursor-pointer"
              >
                View All Couture →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
              {relatedOutfits.map((rel) => (
                <ProductCard
                  key={rel.id}
                  outfit={rel}
                  onRent={onRent}
                  onShare={onShare}
                  onInspect={onSelectOutfit}
                  isWishlisted={wishlist.includes(rel.id)}
                  onToggleWishlist={onToggleWishlist}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

