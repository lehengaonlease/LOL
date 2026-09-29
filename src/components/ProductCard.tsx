import React, { useState, useMemo, useEffect } from 'react';
import { Heart, Share2, Film } from 'lucide-react';
import { LehengaOutfit, resolveOutfitColor, getOutfitColorSwatch } from '../types';
import { VideoPlayer, resolvePublicVideoPath } from './VideoPlayer';
import { OptimizedImage, resolveOptimizedImagePath } from './OptimizedImage';

interface ProductCardProps {
  outfit: LehengaOutfit;
  onRent: (outfit: LehengaOutfit) => void;
  onShare: (outfit: LehengaOutfit) => void;
  onInspect: (outfit: LehengaOutfit) => void;
  isWishlisted: boolean;
  onToggleWishlist: (id: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  outfit,
  onRent,
  onShare,
  onInspect,
  isWishlisted,
  onToggleWishlist,
}) => {
  const mediaItems = useMemo(() => {
    const items: { type: 'image' | 'video'; url: string; label: string }[] = [];

    // If a video is selected for this listing, it is the primary thumbnail (index 0); otherwise Photo 1 is the main thumbnail
    const vid = (outfit.videoUrl || (outfit.mediaType === 'video' ? outfit.mediaUrl : '')).trim();
    if (vid) {
      items.push({
        type: 'video',
        url: resolvePublicVideoPath(vid),
        label: 'Video',
      });
    }

    const imgs =
      Array.isArray(outfit.images) && outfit.images.length > 0
        ? outfit.images.map((s) => s.trim()).filter(Boolean).slice(0, 4)
        : outfit.mediaType === 'image' && outfit.mediaUrl
        ? [outfit.mediaUrl]
        : [];

    imgs.forEach((url, idx) => {
      items.push({
        type: 'image',
        url: resolveOptimizedImagePath(url),
        label: imgs.length > 1 ? `Photo ${idx + 1}` : 'Photo 1',
      });
    });

    if (items.length === 0) {
      const fallbackPhoto =
        (outfit.mediaType === 'image' && outfit.mediaUrl ? outfit.mediaUrl : '') ||
        '/images/lehenga-orange-zardosi.jpg';
      items.push({
        type: 'image',
        url: resolveOptimizedImagePath(fallbackPhoto),
        label: 'Photo 1',
      });
    }

    return items;
  }, [outfit]);

  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  // Reset to primary thumbnail (video if present) when outfit changes
  useEffect(() => {
    setActiveMediaIndex(0);
  }, [outfit.id, outfit.videoUrl, outfit.mediaUrl]);

  const currentMedia = mediaItems[activeMediaIndex] || mediaItems[0];

  return (
    <article className="image group flex flex-col bg-white rounded-2xl overflow-hidden border border-[#F8BBD0]/60 hover:border-[#F48FB1] transition-all duration-300 hover:shadow-[0_16px_40px_-12px_rgba(216,27,96,0.14)]">
      {/* 3:4 Full-Length Portrait Container */}
      <div
        onClick={() => onInspect(outfit)}
        className="relative aspect-[3/4] w-full bg-[#FFF0F5] overflow-hidden cursor-pointer"
      >
        {currentMedia.type === 'video' ? (
          <VideoPlayer
            src={currentMedia.url}
            fallbackSrc="/lehenga-reel.mp4"
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <OptimizedImage
            src={currentMedia.url}
            alt={outfit.title}
            className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
          />
        )}

        {/* Subtle Top Row: Floating Wishlist */}
        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-start z-10">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleWishlist(outfit.id);
              }}
              aria-label="Save to Wishlist"
              className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-md border border-[#F8BBD0]/60 flex items-center justify-center text-[#4A1525] hover:bg-[#FFF0F5] transition-colors shadow-xs cursor-pointer"
            >
              <Heart
                className={`w-4 h-4 transition-colors ${
                  isWishlisted ? 'fill-[#D81B60] text-[#D81B60]' : 'text-[#4A1525]/70'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Media Switcher Pill on Hover when multiple photos or video exist */}
        {mediaItems.length > 1 && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-1 bg-white/95 backdrop-blur-md border border-[#F8BBD0]/60 rounded-xl p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-sm"
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
        )}
      </div>

      {/* Clean Editorial Details Section */}
      <div className="p-5 flex-1 flex flex-col justify-between bg-white">
        <div>
          {/* Category & Availability */}
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-[#880E4F]/65 font-semibold mb-1.5">
            <span>{outfit.vibeCategory}</span>
            <span
              className={`font-semibold ${
                outfit.available !== false ? 'text-emerald-700' : 'text-amber-600'
              }`}
            >
              {outfit.available !== false ? 'Available' : 'Booked'}
            </span>
          </div>

          {/* Title */}
          <a
            href={`/outfit/${outfit.id}`}
            onClick={(e) => {
              e.preventDefault();
              onInspect(outfit);
            }}
            className="block font-editorial text-2xl font-semibold text-[#4A1525] leading-snug group-hover:text-[#D81B60] transition-colors cursor-pointer line-clamp-1"
          >
            {outfit.title}
          </a>

          {/* Short Description */}
          <p className="text-xs text-[#4A1525]/65 line-clamp-2 mt-1.5 leading-relaxed">
            {outfit.description}
          </p>

          {/* Sizes Row */}
          {outfit.sizes.length > 0 && (
            <div className="mt-3.5 pt-3 border-t border-[#FCE4EC] flex items-center justify-between gap-2 text-[11px] text-[#4A1525]/70">
              <span className="text-[10px] uppercase tracking-wider text-[#4A1525]/55 font-semibold">
                Sizes
              </span>
              <span className="shrink-0 font-mono-num text-[10px] text-[#4A1525] bg-[#FFF0F5] px-2.5 py-0.5 rounded-full border border-[#F8BBD0]/60">
                {outfit.sizes.join(' • ')}
              </span>
            </div>
          )}
        </div>

        {/* Pricing & Action Row */}
        <div className="mt-4 pt-3.5 border-t border-[#FCE4EC] flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold text-[#4A1525]">
              ₹{outfit.pricePerDay.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-[#4A1525]/55">/ day</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onShare(outfit)}
              className="p-2.5 rounded-xl bg-[#FFF0F5] border border-[#F8BBD0] text-[#4A1525] hover:text-[#D81B60] hover:border-[#D81B60] transition-colors cursor-pointer"
              title="Share Outfit"
              aria-label="Share Outfit"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onRent(outfit)}
              className="px-4 py-2.5 rounded-xl bg-[#D81B60] text-white text-xs uppercase tracking-wider font-semibold hover:bg-[#AD1457] transition-colors shadow-xs cursor-pointer"
            >
              Rent Now
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
