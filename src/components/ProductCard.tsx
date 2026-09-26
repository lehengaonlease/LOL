import React, { useState } from 'react';
import { Heart, Share2, Eye, MapPin } from 'lucide-react';
import { LehengaOutfit } from '../types';

interface ProductCardProps {
  outfit: LehengaOutfit;
  onRent: (outfit: LehengaOutfit) => void;
  onShare: (outfit: LehengaOutfit) => void;
  onInspect: (outfit: LehengaOutfit) => void;
  isWishlisted: boolean;
  onToggleWishlist: (id: string) => void;
}

const CARD_ANGLES = [
  { label: 'Full Look', transform: 'scale-100 object-top' },
  { label: 'Embroidery', transform: 'scale-125 object-center' },
  { label: 'Flare', transform: 'scale-125 object-bottom' },
];

export const ProductCard: React.FC<ProductCardProps> = ({
  outfit,
  onRent,
  onShare,
  onInspect,
  isWishlisted,
  onToggleWishlist,
}) => {
  const [angleIndex, setAngleIndex] = useState(0);

  const savingsPercent = Math.round(
    ((outfit.retailPrice - outfit.pricePerDay) / outfit.retailPrice) * 100
  );

  return (
    <article className="group flex flex-col bg-white rounded-xl overflow-hidden border border-[#1C1310]/8 hover:border-[#1C1310]/20 transition-all duration-300 hover:shadow-[0_16px_40px_-12px_rgba(28,19,16,0.1)]">
      {/* 3:4 Full-Length Portrait Container (Twamev / Mohey Standard) */}
      <div
        onClick={() => onInspect(outfit)}
        className="relative aspect-[3/4] w-full bg-[#F3EFEA] overflow-hidden cursor-pointer"
      >
        {outfit.mediaType === 'video' ? (
          <video
            src={outfit.mediaUrl}
            className="w-full h-full object-cover object-top"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <img
            src={outfit.mediaUrl}
            alt={outfit.title}
            loading="lazy"
            className={`w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 ${CARD_ANGLES[angleIndex].transform}`}
          />
        )}

        {/* Subtle Top Row: SKU & Floating Wishlist/Share */}
        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-10">
          <span className="px-2.5 py-1 rounded bg-white/90 backdrop-blur-md text-[10px] font-mono-num uppercase tracking-wider text-[#1C1310] font-medium">
            {outfit.code}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleWishlist(outfit.id);
              }}
              aria-label="Save to Wishlist"
              className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-[#1C1310] hover:bg-white transition-colors shadow-xs cursor-pointer"
            >
              <Heart
                className={`w-4 h-4 transition-colors ${
                  isWishlisted ? 'fill-[#E85D24] text-[#E85D24]' : 'text-[#1C1310]/70'
                }`}
              />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShare(outfit);
              }}
              aria-label="Share Outfit"
              className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-[#1C1310]/70 hover:text-[#1C1310] hover:bg-white transition-colors shadow-xs cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Clean Angle Switcher Pill on Hover (No Scrollbar) */}
        {outfit.mediaType === 'image' && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-white/95 backdrop-blur-md rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-sm"
          >
            {CARD_ANGLES.map((angle, idx) => (
              <button
                key={angle.label}
                type="button"
                onClick={() => setAngleIndex(idx)}
                className={`flex-1 py-1 text-[10px] font-medium rounded-md transition-colors cursor-pointer ${
                  angleIndex === idx
                    ? 'bg-[#1C1310] text-white'
                    : 'text-[#1C1310]/70 hover:text-[#1C1310]'
                }`}
              >
                {angle.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Clean Editorial Details Section */}
      <div className="p-5 flex-1 flex flex-col justify-between bg-white">
        <div>
          {/* Category & Availability */}
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-[#1C1310]/55 font-medium mb-1.5">
            <span>{outfit.vibeCategory}</span>
            <span className="text-emerald-700 font-semibold">Available</span>
          </div>

          {/* Title */}
          <h3
            onClick={() => onInspect(outfit)}
            className="font-editorial text-2xl font-semibold text-[#1C1310] leading-snug group-hover:text-[#E85D24] transition-colors cursor-pointer line-clamp-1"
          >
            {outfit.title}
          </h3>

          {/* Short Description */}
          <p className="text-xs text-[#1C1310]/65 line-clamp-2 mt-1.5 leading-relaxed">
            {outfit.description}
          </p>

          {/* Venue Note & Sizes */}
          <div className="mt-3.5 pt-3 border-t border-[#1C1310]/8 flex items-center justify-between gap-2 text-[11px] text-[#1C1310]/65">
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 text-[#E85D24] shrink-0" />
              <span className="truncate">{outfit.indoreHotspot}</span>
            </span>
            <span className="shrink-0 font-mono-num text-[10px] text-[#1C1310]/70 bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#1C1310]/10">
              {outfit.sizes.join(' • ')}
            </span>
          </div>
        </div>

        {/* Pricing & Action Row */}
        <div className="mt-4 pt-3.5 border-t border-[#1C1310]/8 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-semibold text-[#1C1310]">
                ₹{outfit.pricePerDay.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-[#1C1310]/55">/ day</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-[#1C1310]/40 line-through">
                MRP ₹{outfit.retailPrice.toLocaleString('en-IN')}
              </span>
              <span className="text-[#E85D24] font-semibold">Save {savingsPercent}%</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onInspect(outfit)}
              className="p-2.5 rounded-lg border border-[#1C1310]/15 text-[#1C1310]/75 hover:text-[#1C1310] hover:border-[#1C1310]/40 transition-colors cursor-pointer"
              title="Quick View"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onRent(outfit)}
              className="px-4 py-2.5 rounded-lg bg-[#1C1310] text-white text-xs uppercase tracking-wider font-semibold hover:bg-[#E85D24] transition-colors cursor-pointer"
            >
              Rent Now
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
