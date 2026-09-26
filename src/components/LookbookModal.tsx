import React, { useState } from 'react';
import {
  X,
  Heart,
  Share2,
  MapPin,
  Clock,
  ShieldCheck,
  Sparkles,
  Ruler,
  Check,
} from 'lucide-react';
import { LehengaOutfit } from '../types';

interface LookbookModalProps {
  outfit: LehengaOutfit | null;
  onClose: () => void;
  onRent: (outfit: LehengaOutfit) => void;
  onShare: (outfit: LehengaOutfit) => void;
  isWishlisted: boolean;
  onToggleWishlist: (id: string) => void;
}

const VIEW_ANGLES = [
  {
    id: 'full',
    label: 'Full Look',
    caption: 'Complete lehenga, blouse & dupatta silhouette',
    transform: 'scale-100 object-top',
  },
  {
    id: 'embroidery',
    label: 'Zardosi & Choli',
    caption: 'Close-up of hand embroidery, mirror & neckline craft',
    transform: 'scale-135 object-center',
  },
  {
    id: 'flare',
    label: 'Ghera & Flare',
    caption: 'Full can-can volume and border detail',
    transform: 'scale-130 object-bottom',
  },
  {
    id: 'drape',
    label: 'Dupatta Drape',
    caption: 'Upper shoulder & veil styling',
    transform: 'scale-125 object-top',
  },
];

export const LookbookModal: React.FC<LookbookModalProps> = ({
  outfit,
  onClose,
  onRent,
  onShare,
  isWishlisted,
  onToggleWishlist,
}) => {
  const [activeAngle, setActiveAngle] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>('');

  if (!outfit) return null;

  const currentSize = selectedSize || outfit.sizes[0] || 'M';
  const savingsPercent = Math.round(
    ((outfit.retailPrice - outfit.pricePerDay) / outfit.retailPrice) * 100
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#1C1310]/10 grid grid-cols-1 md:grid-cols-12 max-h-[92vh]"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close quick view"
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md border border-[#1C1310]/10 flex items-center justify-center text-[#1C1310]/70 hover:text-[#1C1310] hover:bg-white transition-colors shadow-sm cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left Column: Full-Bleed Portrait & Clean Angle Switcher */}
        <div className="md:col-span-6 bg-[#F4F1EA] relative flex flex-col justify-between min-h-[360px] sm:min-h-[480px] max-h-[52vh] md:max-h-[92vh] overflow-hidden">
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
              className={`w-full h-full object-cover transition-transform duration-700 ease-out ${VIEW_ANGLES[activeAngle].transform}`}
            />
          )}

          {/* Top Left SKU Tag */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-[11px] font-mono-num font-semibold text-[#1C1310] shadow-xs">
              {outfit.code}
            </span>
            <span className="px-3 py-1 rounded-full bg-[#1C1310]/80 backdrop-blur-md text-[10px] uppercase tracking-wider text-white font-medium">
              {VIEW_ANGLES[activeAngle].label}
            </span>
          </div>

          {/* Bottom Clean Angle Selector Bar (Grid of 4 — Never Scrolls Horizontally) */}
          {outfit.mediaType === 'image' && (
            <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md p-2 rounded-xl shadow-md border border-[#1C1310]/8">
              <div className="grid grid-cols-4 gap-1.5">
                {VIEW_ANGLES.map((angle, idx) => (
                  <button
                    key={angle.id}
                    type="button"
                    onClick={() => setActiveAngle(idx)}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all cursor-pointer truncate ${
                      activeAngle === idx
                        ? 'bg-[#1C1310] text-white font-semibold'
                        : 'text-[#1C1310]/70 hover:bg-[#FAF8F5] hover:text-[#1C1310]'
                    }`}
                  >
                    {angle.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-center text-[#1C1310]/55 mt-1.5">
                {VIEW_ANGLES[activeAngle].caption}
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Luxury Editorial Details */}
        <div className="md:col-span-6 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto luxury-scroll">
          <div className="space-y-5">
            {/* Category & Wishlist */}
            <div className="flex items-center justify-between gap-2 pr-8">
              <span className="text-[11px] uppercase tracking-[0.2em] text-[#E85D24] font-semibold">
                {outfit.vibeCategory}
              </span>
              <button
                onClick={() => onToggleWishlist(outfit.id)}
                className="inline-flex items-center gap-1.5 text-xs text-[#1C1310]/65 hover:text-[#1C1310] transition-colors cursor-pointer"
              >
                <Heart
                  className={`w-4 h-4 ${
                    isWishlisted ? 'fill-[#E85D24] text-[#E85D24]' : 'text-[#1C1310]/60'
                  }`}
                />
                <span>{isWishlisted ? 'Saved' : 'Save'}</span>
              </button>
            </div>

            {/* Title */}
            <div>
              <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#1C1310] leading-tight">
                {outfit.title}
              </h2>

              {/* Price Block */}
              <div className="mt-3 flex items-baseline gap-3 flex-wrap">
                <span className="text-2xl font-semibold text-[#1C1310]">
                  ₹{outfit.pricePerDay.toLocaleString('en-IN')}
                  <span className="text-xs font-normal text-[#1C1310]/60"> / day rental</span>
                </span>
                <span className="text-xs text-[#1C1310]/45 line-through">
                  MRP ₹{outfit.retailPrice.toLocaleString('en-IN')}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold">
                  Save {savingsPercent}%
                </span>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-[#1C1310]/75 leading-relaxed">
              {outfit.description}
            </p>

            {/* Size Selection */}
            <div className="pt-2 border-t border-[#1C1310]/10">
              <div className="flex items-center justify-between text-xs mb-2.5">
                <span className="font-semibold uppercase tracking-wider text-[#1C1310]/80 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-[#E85D24]" />
                  Select Size
                </span>
                <span className="text-[#1C1310]/55 text-[11px]">
                  Custom waist & choli fitting included
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {outfit.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      currentSize === size
                        ? 'border-[#1C1310] bg-[#1C1310] text-white'
                        : 'border-[#1C1310]/15 bg-[#FAF8F5] text-[#1C1310] hover:border-[#1C1310]/40'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Studio Highlights */}
            <div className="bg-[#FAF8F5] rounded-xl p-4 space-y-2.5 border border-[#1C1310]/8 text-xs text-[#1C1310]/80">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-[#E85D24] shrink-0" />
                <span>{outfit.indoreHotspot}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#E85D24] shrink-0" />
                <span>24-Hour Next-Day Return • Zero dry-cleaning fee</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#E85D24] shrink-0" />
                <span>Hospital-grade steam sanitized & sealed packaging</span>
              </div>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="pt-6 mt-6 border-t border-[#1C1310]/10 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                onShare(outfit);
              }}
              className="px-4 py-3.5 rounded-xl border border-[#1C1310]/15 text-xs font-semibold text-[#1C1310] hover:bg-[#FAF8F5] transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onRent(outfit);
              }}
              className="flex-1 py-3.5 px-6 rounded-xl bg-[#1C1310] text-white text-xs uppercase tracking-[0.16em] font-semibold hover:bg-[#E85D24] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Reserve This Lehenga</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
