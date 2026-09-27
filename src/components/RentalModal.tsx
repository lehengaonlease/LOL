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

function addDaysToDateStr(dateStr: string, daysToAdd: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + daysToAdd);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const RentalModal: React.FC<RentalModalProps> = ({
  outfit,
  onClose,
  onConfirmBooking,
}) => {
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [eventDate, setEventDate] = useState(tomorrowStr);
  const [returnDate, setReturnDate] = useState(() => addDaysToDateStr(tomorrowStr, 1));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const minReturnDateStr = useMemo(() => {
    if (!eventDate) return tomorrowStr;
    return addDaysToDateStr(eventDate, 1);
  }, [eventDate, tomorrowStr]);

  // Calculate rental duration in days (1 day = 24 hours; 2 days > 24 hours = 2x daily rent, etc.)
  const rentalDays = useMemo(() => {
    if (!eventDate || !returnDate) return 1;
    const [y1, m1, d1] = eventDate.split('-').map(Number);
    const [y2, m2, d2] = returnDate.split('-').map(Number);
    const start = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  }, [eventDate, returnDate]);

  const totalRent = useMemo(() => {
    if (!outfit) return 0;
    return outfit.pricePerDay * rentalDays;
  }, [outfit, rentalDays]);

  const returnDateInfo = useMemo(() => {
    if (!returnDate) {
      return {
        dateStr: '',
        dateOnly: 'Select return date',
        formatted: 'Select return date',
      };
    }
    const [year, month, day] = returnDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dateOnly = formatTimelineDate(dateObj);

    return {
      dateStr: returnDate,
      dateOnly,
      formatted: `${dateOnly} (Before 12:00 PM)`,
    };
  }, [returnDate]);

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
      `▪️ Per Day Rent: ₹${outfit.pricePerDay.toLocaleString('en-IN')}/day`,
      `▪️ Duration: ${rentalDays} ${rentalDays === 1 ? 'Day (24 Hours)' : `Days (${rentalDays * 24} Hours)`}`,
      `▪️ Total Rent: ₹${totalRent.toLocaleString('en-IN')}`,
      ``,
      `📅 RENTAL TIMELINE:`,
      `• Event / Pickup Date: ${formattedEventDate}`,
      `• Return Date: ${returnDateInfo.dateOnly} (Before 12:00 PM)`,
      ``,
      `👤 MY DETAILS:`,
      `• Name: ${customerName.trim() || 'Guest'}`,
      `• Phone: ${customerPhone.trim() || 'Not provided'}`,
      `--------------------------------------------`,
      `Please share your available trial and Pickup slots so I can lock this look in! ✨🧡`,
    ].join('\n');

    return `https://wa.me/${STUDIO_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }, [
    outfit,
    rentalDays,
    totalRent,
    formattedEventDate,
    returnDateInfo.dateOnly,
    customerName,
    customerPhone,
  ]);

  if (!outfit) return null;

  const handleEventDateChange = (nextEventDate: string) => {
    setEventDate(nextEventDate);
    if (nextEventDate) {
      const nextMinReturn = addDaysToDateStr(nextEventDate, 1);
      if (!returnDate || returnDate < nextMinReturn) {
        setReturnDate(nextMinReturn);
      }
    }
  };

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
    if (!returnDate) {
      setValidationError('Please select your return date.');
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
          agreedToNextDayReturn: true,
        },
        false
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
              <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                <span className="text-base font-semibold text-[#E85D24]">
                  ₹{totalRent.toLocaleString('en-IN')} total
                </span>
                <span className="text-[11px] text-[#1C1310]/60">
                  (₹{outfit.pricePerDay.toLocaleString('en-IN')}/day × {rentalDays}{' '}
                  {rentalDays === 1 ? 'day' : 'days'})
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
                  Your reservation from <strong className="text-[#1C1310]">{formattedEventDate}</strong>{' '}
                  to <strong className="text-[#1C1310]">{returnDateInfo.formatted}</strong> (
                  {rentalDays} {rentalDays === 1 ? 'day' : 'days'} • ₹
                  {totalRent.toLocaleString('en-IN')}) has been logged.
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

              {/* Event Date, Return Date & Rental Period Price Calculator */}
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#1C1310]/10 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/75 mb-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#E85D24]" />
                      Event Date *
                    </label>
                    <input
                      type="date"
                      min={tomorrowStr}
                      value={eventDate}
                      onChange={(e) => handleEventDateChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#1C1310]/15 rounded-lg text-xs font-medium text-[#1C1310] focus:outline-none focus:border-[#1C1310]"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/75 mb-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#E85D24]" />
                      Return Date *
                    </label>
                    <input
                      type="date"
                      min={minReturnDateStr}
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#1C1310]/15 rounded-lg text-xs font-medium text-[#1C1310] focus:outline-none focus:border-[#1C1310]"
                    />
                  </div>
                </div>

                {/* Automatic Multi-Day Rent Calculation Breakdown */}
                <div className="pt-3 border-t border-[#1C1310]/10 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1C1310]/55 block">
                      Selected Rental Period
                    </span>
                    <span className="text-xs font-semibold text-[#1C1310]">
                      {rentalDays === 1
                        ? '1 Day (Up to 24 Hours)'
                        : `${rentalDays} Days (${rentalDays * 24} Hours)`}{' '}
                      • Return before 12:00 PM
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1C1310]/55 block">
                      ₹{outfit.pricePerDay.toLocaleString('en-IN')}/day × {rentalDays}{' '}
                      {rentalDays === 1 ? 'day' : 'days'}
                    </span>
                    <span className="text-base font-bold text-[#E85D24]">
                      ₹{totalRent.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <a
                  href={whatsappBookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    setValidationError(null);
                    if (!customerName.trim()) {
                      e.preventDefault();
                      setValidationError('Please enter your name so we can reserve your trial slot.');
                      return;
                    }
                    if (!eventDate) {
                      e.preventDefault();
                      setValidationError('Please select your event date.');
                      return;
                    }
                    if (!returnDate) {
                      e.preventDefault();
                      setValidationError('Please select your return date.');
                      return;
                    }
                    if (isSubmitting) {
                      e.preventDefault();
                      return;
                    }

                    setIsSubmitting(true);
                    onConfirmBooking(
                      {
                        outfit,
                        customerName: customerName.trim(),
                        customerPhone: customerPhone.trim() || 'Not provided',
                        eventDate,
                        returnDate: returnDateInfo.dateStr,
                        agreedToNextDayReturn: true,
                      },
                      false
                    )
                      .then(() => {
                        setBookingComplete(true);
                      })
                      .catch((err) => {
                        setValidationError(
                          err instanceof Error
                            ? err.message
                            : 'Could not save booking. Please try again.'
                        );
                      })
                      .finally(() => {
                        setIsSubmitting(false);
                      });
                  }}
                  className="w-full py-3.5 px-6 rounded-xl bg-[#1C1310] text-white text-xs uppercase tracking-[0.15em] font-semibold hover:bg-[#E85D24] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'Reserving...'
                      : `Confirm Reservation • ₹${totalRent.toLocaleString('en-IN')}`}
                  </span>
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
