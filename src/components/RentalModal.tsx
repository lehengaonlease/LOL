import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  Clock,
  CheckCircle2,
  Send,
  CheckSquare,
  Sparkles,
  User,
  ShieldCheck,
} from 'lucide-react';
import { LehengaOutfit, RentalBookingDraft } from '../types';

interface RentalModalProps {
  outfit: LehengaOutfit | null;
  onClose: () => void;
  onConfirmBooking: (booking: RentalBookingDraft, syncToGoogleTasks: boolean) => Promise<void>;
  isTasksConnected: boolean;
}

const STUDIO_WHATSAPP_NUMBER = '919826000000';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

function formatTimelineDate(dateObj: Date): string {
  const weekday = WEEKDAYS[dateObj.getDay()];
  const day = dateObj.getDate();
  const month = MONTHS[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  return `${weekday}, ${day} ${month}, ${year}`;
}

export const RentalModal: React.FC<RentalModalProps> = ({
  outfit,
  onClose,
  onConfirmBooking,
  isTasksConnected,
}) => {
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [eventDate, setEventDate] = useState(tomorrowStr);
  const [agreedToReturnPolicy, setAgreedToReturnPolicy] = useState(false);
  const [syncTasks, setSyncTasks] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const returnDateInfo = useMemo(() => {
    if (!eventDate) {
      return {
        dateStr: '',
        dateOnly: 'Select event date',
        formatted: 'Select event date',
      };
    }
    const [year, month, day] = eventDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    dateObj.setDate(dateObj.getDate() + 1);

    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');

    const dateOnly = formatTimelineDate(dateObj);

    return {
      dateStr: `${yyyy}-${mm}-${dd}`,
      dateOnly,
      formatted: `${dateOnly} (Before 12:00 PM)`,
    };
  }, [eventDate]);

  const formattedEventDate = useMemo(() => {
    if (!eventDate) return '';
    const [year, month, day] = eventDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return formatTimelineDate(dateObj);
  }, [eventDate]);

  const whatsappBookingUrl = useMemo(() => {
    if (!outfit) return '';
    const message = [
      `Hey LOL Team! 👋 `,
      ``,
      `I'm ready to secure some serious main character energy! Can you please check if this outfit is available for my dates? 🥂🔥`,
      ``,
      `🥻 OUTFIT DETAILS:`,
      `▪️ Name: ${outfit.title}`,
      `▪️ Code: ${outfit.code}`,
      `▪️ Rent: ₹${outfit.pricePerDay.toLocaleString('en-IN')}/day`,
      ``,
      `📅 RENTAL TIMELINE:`,
      `• Wear Date: ${formattedEventDate}`,
      `• Return Deadline: ${returnDateInfo.dateOnly} (Before 12:00 PM)`,
      ``,
      `👤 MY DETAILS:`,
      `• Name: ${customerName.trim() || 'Guest'}`,
      `• Phone: ${customerPhone.trim() || 'Not provided'}`,
      `--------------------------------------------`,
      `✅ VIBE CHECK: Passed! I explicitly agree to the 24-Hour Next-Day Return Policy. `,
      ``,
      `Please share your available trial and Pickup slots so I can lock this look in! ✨🧡`,
    ].join('\n');

    return `https://wa.me/${STUDIO_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }, [outfit, formattedEventDate, returnDateInfo.dateOnly, customerName, customerPhone]);

  if (!outfit) return null;

  const handleCompleteBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!customerName.trim()) {
      setValidationError('Please enter your name so we can reserve your trial slot.');
      return;
    }
    if (!eventDate) {
      setValidationError('Please select your event date.');
      return;
    }
    if (!agreedToReturnPolicy) {
      setValidationError(
        'Please confirm the 24-Hour Next-Day Return policy to unlock instant reservation.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmBooking(
        {
          outfit,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || 'Not provided',
          eventDate,
          returnDate: returnDateInfo.dateStr,
          agreedToNextDayReturn: agreedToReturnPolicy,
        },
        syncTasks
      );
      setBookingComplete(true);
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : 'Could not save booking. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-[#1C1310]/10 overflow-hidden my-auto max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#1C1310]/10 flex items-center justify-between bg-[#FAF8F5]">
          <div>
            <h3 className="font-editorial text-2xl font-semibold text-[#1C1310]">
              Reserve Your Lehenga
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-[#1C1310]/10 flex items-center justify-center text-[#1C1310]/60 hover:text-[#1C1310] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto luxury-scroll space-y-5">
          {/* Selected Outfit Summary */}
          <div className="flex gap-4 p-3.5 rounded-xl bg-[#FAF8F5] border border-[#1C1310]/8 items-center">
            <img
              src={outfit.mediaUrl}
              alt={outfit.title}
              className="w-16 h-20 rounded-lg object-cover object-top shrink-0 bg-[#EFECE6]"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-[#1C1310]/50 font-semibold">
                {outfit.vibeCategory}
              </p>
              <h4 className="font-editorial text-xl font-semibold text-[#1C1310] truncate">
                {outfit.title}
              </h4>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-base font-semibold text-[#E85D24]">
                  ₹{outfit.pricePerDay.toLocaleString('en-IN')}/day
                </span>
              </div>
            </div>
          </div>

          {bookingComplete ? (
            <div className="py-6 text-center space-y-5">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-editorial text-3xl font-semibold text-[#1C1310]">
                  Reservation Logged
                </h4>
                <p className="text-xs text-[#1C1310]/65 max-w-md mx-auto leading-relaxed">
                  Your return reminder for{' '}
                  <strong className="text-[#1C1310]">{returnDateInfo.formatted}</strong> has been
                  scheduled. Send the pre-filled WhatsApp message below to lock your trial slot at
                  our Indore studio.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <a
                  href={whatsappBookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3.5 px-6 rounded-xl bg-[#25D366] text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#1ebe57] transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>Send WhatsApp to Studio</span>
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3.5 px-5 rounded-xl border border-[#1C1310]/15 text-xs font-semibold text-[#1C1310] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCompleteBooking} className="space-y-4">
              {validationError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  {validationError}
                </div>
              )}

              {/* Customer Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70 mb-1.5">
                    Your Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#1C1310]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g., Ananya Sharma"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310] focus:outline-none focus:bg-white focus:border-[#1C1310]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/70 mb-1.5">
                    WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 98260 XXXXX"
                    className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#1C1310]/15 rounded-xl text-xs text-[#1C1310] focus:outline-none focus:bg-white focus:border-[#1C1310]"
                  />
                </div>
              </div>

              {/* Event Date & Automatic Return Calculator */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-xl bg-[#FAF8F5] border border-[#1C1310]/10">
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/75 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#E85D24]" />
                    Event Date *
                  </label>
                  <input
                    type="date"
                    min={tomorrowStr}
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#1C1310]/15 rounded-lg text-xs font-medium text-[#1C1310] focus:outline-none focus:border-[#1C1310]"
                  />
                </div>

                <div className="flex flex-col justify-center">
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#E85D24]">
                    <Clock className="w-3 h-3" />
                    Scheduled Next-Day Return
                  </span>
                  <p className="text-xs font-semibold text-[#1C1310] mt-1">
                    {returnDateInfo.formatted}
                  </p>
                </div>
              </div>

              {/* Mandatory 24-Hr Return Policy Checkbox */}
              <label
                className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                  agreedToReturnPolicy
                    ? 'bg-emerald-50/50 border-emerald-600/40'
                    : 'bg-white border-[#1C1310]/15 hover:border-[#1C1310]/35'
                }`}
              >
                <input
                  type="checkbox"
                  checked={agreedToReturnPolicy}
                  onChange={(e) => setAgreedToReturnPolicy(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#1C1310] rounded cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-[#1C1310] block">
                    I agree to the 24-Hour Next-Day Return Policy *
                  </span>
                  <span className="text-[#1C1310]/65 text-[11px] leading-relaxed block mt-0.5">
                    I will return <strong>{outfit.code}</strong> on{' '}
                    <strong className="text-[#1C1310]">{returnDateInfo.formatted}</strong> so it can
                    be steam-sanitized for the next guest.
                  </span>
                </div>
              </label>

              {/* Google Tasks Reminder Option */}
              <label className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#FAF8F5] border border-[#1C1310]/8 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <CheckSquare className="w-4 h-4 text-[#E85D24]" />
                  <div>
                    <span className="text-xs font-medium text-[#1C1310] block">
                      Auto-create return & dry-clean task reminder
                    </span>
                    <span className="text-[10px] text-[#1C1310]/55 block">
                      {isTasksConnected
                        ? 'Synced with your connected Google Tasks'
                        : 'Saved to Studio Bookings & ready for 1-click Google Tasks sync'}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={syncTasks}
                  onChange={(e) => setSyncTasks(e.target.checked)}
                  className="w-4 h-4 accent-[#1C1310] rounded cursor-pointer"
                />
              </label>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 px-6 rounded-xl bg-[#1C1310] text-white text-xs uppercase tracking-[0.15em] font-semibold hover:bg-[#E85D24] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isSubmitting ? 'Reserving...' : 'Confirm Reservation'}</span>
                </button>

                <a
                  href={agreedToReturnPolicy ? whatsappBookingUrl : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (!agreedToReturnPolicy) {
                      e.preventDefault();
                      setValidationError(
                        'Please check the 24-Hour Next-Day Return agreement box above first.'
                      );
                    }
                  }}
                  className={`py-3.5 px-5 rounded-xl font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                    agreedToReturnPolicy
                      ? 'bg-[#25D366] text-white hover:bg-[#1ebe57] cursor-pointer'
                      : 'bg-[#FAF8F5] text-[#1C1310]/40 border border-[#1C1310]/10 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Direct WhatsApp</span>
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
