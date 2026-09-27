import React, { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, Share2, Send, Sparkles, RefreshCw } from 'lucide-react';
import { LehengaOutfit } from '../types';
import { OptimizedImage } from './OptimizedImage';

interface ShareModalProps {
  outfit: LehengaOutfit | null;
  onClose: () => void;
}

const HINGLISH_OPENERS = [
  'Yeh Dekha Kya?! 👀🔥',
  'Oye! Yeh Dekha Kya?! 😍✨',
  'Bestie ruk jaa! Yeh Dekha Kya?! 😭💖',
  'Yaar sunn!! Yeh Dekha Kya?! 🤩💃',
  'Babe wake up! Yeh Dekha Kya?! 🔥✨',
  'Brooo Yeh Dekha Kya?! Literal dream fit mil gaya! 😍🔥',
];

const HINGLISH_APPRECIATIONS = [
  (title: string, price: string) =>
    `*${title}* kitna zyada gorgeous aur dreamy lag raha hai yaar! 😍 Indore mein itne reasonable rate (*sirf ₹${price}/day*) pe aisi designer lehenga vibe mil rahi hai at *LOL By Sanjeevani*! 💅✨`,
  (title: string, price: string) =>
    `*${title}* ka flare aur detailing dekh ek baar—pure main-character energy hai! 🔥 Aur sabse best part? Indore mein super reasonable rates (*just ₹${price}/day*) mein rent pe available hai! 💃`,
  (title: string, price: string) =>
    `Iss function mein *${title}* pehen ke entry maarenge toh sab dekhte reh jayenge! 🤩 Woh bhi Indore mein itne pocket-friendly aur reasonable rate (*₹${price}/day only*) pe! 🥂💖`,
  (title: string, price: string) =>
    `*${title}* literally next-level lag raha hai! 😍 Laakhon kharch karne ki jagah Indore mein itne sahi aur reasonable price (*₹${price}/day*) pe poora celebrity look mil raha hai! ✨🔥`,
  (title: string, price: string) =>
    `Sach bata *${title}* tujhpe kitnakamaal lagega yaar! 💖 Indore mein sabse aesthetic collection aur super reasonable rates (*₹${price}/day*) yahin milenge! 🤩✨`,
];

const HINGLISH_CTAS = [
  'Jaldi contact kar or reserve kar inki dresses, warna koi aur book kar lega! 🏃‍♀️💨',
  'Der mat kar yaar, jaldi contact kar aur apni dates ke liye reserve kar le inki dresses! 🔥📲',
  'Jaldi se contact kar or reserve kare inki dresses—chal aaj hi trial plan karte hain! 💃✨',
  'Wedding & Garba dates full hone se pehle jaldi contact kar or reserve kar inki dresses! 🥂🔥',
];

function buildDynamicHinglishMessage(
  outfit: LehengaOutfit,
  shareUrl: string,
  lastMessage?: string
): string {
  const formattedPrice = outfit.pricePerDay.toLocaleString('en-IN');

  for (let attempt = 0; attempt < 6; attempt++) {
    const opener = HINGLISH_OPENERS[Math.floor(Math.random() * HINGLISH_OPENERS.length)];
    const appreciationFn =
      HINGLISH_APPRECIATIONS[Math.floor(Math.random() * HINGLISH_APPRECIATIONS.length)];
    const cta = HINGLISH_CTAS[Math.floor(Math.random() * HINGLISH_CTAS.length)];

    const candidate = [
      opener,
      '',
      appreciationFn(outfit.title, formattedPrice),
      '',
      cta,
      '',
      '📞 Contact: 7697246823, 7000861465',
      '✨ *Rent : Flex : Return* ✨',
      '',
      shareUrl,
    ].join('\n');

    if (candidate !== lastMessage) {
      return candidate;
    }
  }

  return [
    'Yeh Dekha Kya?! 👀🔥',
    '',
    `*${outfit.title}* kitna zyada dreamy lag raha hai yaar! 😍 Indore mein itne reasonable rate (*sirf ₹${formattedPrice}/day*) pe mil raha hai at *LOL By Sanjeevani*!`,
    '',
    'Jaldi contact kar or reserve kare inki dresses! 💃✨',
    '',
    '📞 Contact: 7697246823, 7000861465',
    '✨ *Rent : Flex : Return* ✨',
    '',
    shareUrl,
  ].join('\n');
}

export const ShareModal: React.FC<ShareModalProps> = ({ outfit, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [dynamicMessage, setDynamicMessage] = useState('');

  const shareUrl = outfit
    ? `${window.location.origin}/outfit/${encodeURIComponent(outfit.id)}`
    : '';

  const regenerateMessage = useCallback(() => {
    if (!outfit) return;
    setDynamicMessage((prev) => buildDynamicHinglishMessage(outfit, shareUrl, prev));
    setCopied(false);
  }, [outfit, shareUrl]);

  // Generate a fresh Hinglish Gen Z message every time the modal opens for an outfit
  useEffect(() => {
    if (outfit) {
      setDynamicMessage(buildDynamicHinglishMessage(outfit, shareUrl));
      setCopied(false);
    }
  }, [outfit, shareUrl]);

  if (!outfit) return null;

  const messageToShare = dynamicMessage || buildDynamicHinglishMessage(outfit, shareUrl);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageToShare);
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
          title: `Yeh Dekha Kya?! ${outfit.title} | LOL Indore`,
          text: messageToShare,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(messageToShare)}`;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#F8BBD0] overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#F8BBD0]/60 flex items-center justify-between bg-[#FFF0F5]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D81B60]" />
            <h3 className="font-editorial text-2xl font-semibold text-[#4A1525]">
              Share With Your Squad
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-[#F8BBD0] flex items-center justify-center text-[#4A1525]/60 hover:text-[#D81B60] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {/* Social Preview Card (Without product code) */}
          <div className="flex items-center gap-3.5 p-3 rounded-xl border border-[#F8BBD0]/70 bg-[#FFF5F8]">
            <OptimizedImage
              src={outfit.mediaUrl}
              alt={outfit.title}
              className="w-16 h-20 rounded-lg object-cover object-top shrink-0 border border-[#F8BBD0]"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-[#D81B60] font-semibold">
                Rent : Flex : Return • Indore
              </p>
              <h4 className="font-editorial text-lg font-semibold text-[#4A1525] truncate mt-0.5">
                {outfit.title}
              </h4>
              <p className="text-xs font-semibold text-[#4A1525] mt-1">
                ₹{outfit.pricePerDay.toLocaleString('en-IN')}/day
              </p>
            </div>
          </div>

          {/* Dynamic Hinglish Message Preview Box */}
          <div className="rounded-xl border border-[#F8BBD0] bg-[#FFF9FB] p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#D81B60]">
                WhatsApp Message Vibe
              </span>
              <button
                type="button"
                onClick={regenerateMessage}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4A1525] hover:text-[#D81B60] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Remix Vibe</span>
              </button>
            </div>
            <pre className="text-xs text-[#4A1525]/90 whitespace-pre-wrap font-sans leading-relaxed bg-white p-3 rounded-lg border border-[#F8BBD0]/60">
              {messageToShare}
            </pre>
          </div>

          {/* Share Actions */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                // Also queue a fresh message for next time
                setTimeout(() => regenerateMessage(), 400);
              }}
              className="py-3 px-4 rounded-xl bg-[#25D366] text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#1ebe57] transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>

            <button
              onClick={handleNativeShare}
              className="py-3 px-4 rounded-xl bg-[#4A1525] text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#D81B60] transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Link</span>
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="w-full py-2.5 px-4 rounded-xl border border-[#F8BBD0] text-xs font-medium text-[#4A1525] hover:bg-[#FFF0F5] transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Copied Hinglish Message!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#D81B60]" />
                <span>Copy Message & Link</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
