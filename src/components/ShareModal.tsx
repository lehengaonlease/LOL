import React, { useState } from 'react';
import { X, Copy, Check, Share2, Send, Sparkles } from 'lucide-react';
import { LehengaOutfit } from '../types';

interface ShareModalProps {
  outfit: LehengaOutfit | null;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ outfit, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!outfit) return null;

  const shareUrl = `${window.location.origin}/outfit/${encodeURIComponent(outfit.id)}`;

  const shareText = `${outfit.title} (${outfit.code}) — Rent for ₹${outfit.pricePerDay.toLocaleString(
    'en-IN'
  )}/day! ${outfit.ogHumorTagline}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${outfit.title} | LOL Lehenga On Lease`,
          text: shareText,
          url: shareUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `*${outfit.title}* (${outfit.code})\n${outfit.ogHumorTagline}\n\nRent in Indore for *₹${outfit.pricePerDay.toLocaleString(
      'en-IN'
    )}/day*\n${shareUrl}`
  )}`;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#1C1310]/10 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1C1310]/10 flex items-center justify-between bg-[#FAF8F5]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#E85D24]" />
            <h3 className="font-editorial text-2xl font-semibold text-[#1C1310]">
              Share With Your Squad
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-[#1C1310]/10 flex items-center justify-center text-[#1C1310]/60 hover:text-[#1C1310] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Social Preview Card */}
          <div className="rounded-xl overflow-hidden border border-[#1C1310]/10 bg-[#FAF8F5]">
            <div className="relative h-48 bg-[#EFECE6]">
              <img
                src={outfit.mediaUrl}
                alt={outfit.title}
                className="w-full h-full object-cover object-top"
              />
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded bg-white/90 backdrop-blur-md text-[10px] font-mono-num font-semibold text-[#1C1310]">
                {outfit.code}
              </span>
            </div>
            <div className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-[#E85D24] font-semibold">
                LOL • Lehenga On Lease Indore
              </p>
              <h4 className="font-editorial text-xl font-semibold text-[#1C1310] mt-0.5">
                {outfit.title}
              </h4>
              <p className="text-xs text-[#1C1310]/70 mt-1 leading-relaxed">
                {outfit.ogHumorTagline}
              </p>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-sm font-semibold text-[#1C1310]">
                  ₹{outfit.pricePerDay.toLocaleString('en-IN')}/day
                </span>
              </div>
            </div>
          </div>

          {/* Share Actions */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-4 rounded-xl bg-[#25D366] text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#1ebe57] transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>

            <button
              onClick={handleNativeShare}
              className="py-3 px-4 rounded-xl bg-[#1C1310] text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#E85D24] transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Link</span>
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="w-full py-2.5 px-4 rounded-xl border border-[#1C1310]/15 text-xs font-medium text-[#1C1310] hover:bg-[#FAF8F5] transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Copied Link & Caption!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#1C1310]/60" />
                <span>Copy Caption & Direct Link</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
