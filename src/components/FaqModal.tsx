import React from 'react';
import { X, Sparkles, HelpCircle } from 'lucide-react';

interface FaqModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FAQ_ITEMS = [
  {
    question: '1. How long can I actually keep the lehenga? Is it just for one day?',
    answer:
      'Keep it as long as your heart desires, bestie! Just pick your exact Pickup Date and Drop Date when you book it. But fair warning: if you don’t hand it back before 12:00 PM on your return date, it triggers our "Don\'t Ghost Us" clause. Late returns cost double the base daily rate, which will be auto-deducted from your security deposit. Return it on time so another Indori kudi can secure her drip! ⏰🚨',
  },
  {
    question: '2. What happens if I accidentally spill food or tear a little embroidery?',
    answer:
      "Look, we know wedding food is messy and Garba gets wild. If it’s just a tiny, minor accidental spot or a little loose thread, we won't charge you a single rupee. We pass the vibe check. But if the damage is non-bearable (like a massive structural tear or a permanent burn), you will be charged the actual cost to fix it. Dress responsibly! 🍷👗",
  },
  {
    question: '3. Do I need to get it dry-cleaned before returning it?',
    answer:
      'Ugh, absolutely not! Leave the adulting to us. We handle 100% of the premium dry-cleaning after every single use so that the next renter gets a flawlessly fresh piece of masti. Just return it as it is. 🧼✨',
  },
  {
    question: '4. How do alterations work? Will the blouse fit my body perfectly?',
    answer:
      'Baggy blouses do not pass the aesthetic check. All our lehengas are free-size, meaning our expert in-house alteration squad will custom-tailor the blouse and waist to your exact body measurements before you pick it up. You’ll look like it was custom-made just for you! 🧵👑',
  },
  {
    question: '5. How much security deposit do I pay, and when do I get it back?',
    answer:
      'It depends on how premium your chosen look is! The refundable deposit ranges anywhere from ₹1,000 to ₹5,000 (it might go higher for ultra-expensive designer pieces). The moment you return the outfit, our team does a quick damage check, and your money flashes right back via your original mode of payment if everything is pristine! 💸💰',
  },
  {
    question: '6. Can I visit a physical store in Indore to try it on?',
    answer:
      "We love a studio trial! You can slide right into our physical location at Silicon City, Indore to pick up your fit and try it on. Don't want to travel? No stress. We can send it directly to your doorstep anywhere in Indore via Porter, you just pay the standard additional local delivery charges! 🛵📍",
  },
];

export const FaqModal: React.FC<FaqModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-[#F8BBD0] overflow-hidden my-auto max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#F8BBD0]/80 flex items-center justify-between bg-[#FFF0F5]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#D81B60] text-white flex items-center justify-center shrink-0 shadow-xs">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#D81B60] font-semibold block">
                Everything You Need To Know
              </span>
              <h3 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#4A1525]">
                LOL FAQ: The Ultimate Vibe Check 💅
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-[#F8BBD0] flex items-center justify-center text-[#4A1525]/70 hover:text-[#D81B60] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* FAQ List */}
        <div className="p-6 overflow-y-auto luxury-scroll space-y-4 bg-gradient-to-b from-[#FFF9FB] to-white">
          {FAQ_ITEMS.map((item, idx) => (
            <div
              key={idx}
              className="p-4 sm:p-5 rounded-2xl bg-white border border-[#F8BBD0]/80 shadow-2xs hover:border-[#D81B60]/60 transition-colors space-y-2"
            >
              <h4 className="font-editorial text-lg sm:text-xl font-semibold text-[#4A1525] leading-snug">
                {item.question}
              </h4>
              <p className="text-xs sm:text-sm text-[#4A1525]/80 leading-relaxed">
                {item.answer}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#F8BBD0]/70 bg-[#FFF0F5]/70 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-xs text-[#4A1525]/75">
            <Sparkles className="w-3.5 h-3.5 text-[#D81B60] shrink-0" />
            <span>Silicon City, Indore • Custom-fitted & Steam-sanitized</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#D81B60] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#AD1457] transition-colors cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
