import React, { useState, useMemo, useEffect } from 'react';
import { X, Calendar, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface DateSelectionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDate: (date: string) => void;
  currentSelectedDate?: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DateSelectionPopup: React.FC<DateSelectionPopupProps> = ({
  isOpen,
  onClose,
  onSelectDate,
  currentSelectedDate,
}) => {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [today]);

  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(() => currentSelectedDate || tomorrowStr);

  // Calendar navigation state (year, month)
  const [navYear, setNavYear] = useState<number>(() => {
    if (currentSelectedDate) {
      const parts = currentSelectedDate.split('-');
      if (parts.length === 3) return Number(parts[0]);
    }
    return today.getFullYear();
  });

  const [navMonth, setNavMonth] = useState<number>(() => {
    if (currentSelectedDate) {
      const parts = currentSelectedDate.split('-');
      if (parts.length === 3) return Number(parts[1]) - 1;
    }
    return today.getMonth();
  });

  useEffect(() => {
    if (isOpen) {
      const initDate = currentSelectedDate || tomorrowStr;
      setSelectedDate(initDate);
      if (initDate) {
        const parts = initDate.split('-');
        if (parts.length === 3) {
          setNavYear(Number(parts[0]));
          setNavMonth(Number(parts[1]) - 1);
        }
      }
    }
  }, [isOpen, currentSelectedDate, tomorrowStr]);

  if (!isOpen) return null;

  // Calendar math
  const daysInMonth = new Date(navYear, navMonth + 1, 0).getDate();
  const startDayOfWeek = new Date(navYear, navMonth, 1).getDay(); // 0 is Sunday

  // Can user navigate to previous month? (Don't allow navigating into the past)
  const isCurrentOrPastMonth =
    navYear < today.getFullYear() ||
    (navYear === today.getFullYear() && navMonth <= today.getMonth());

  const handlePrevMonth = () => {
    if (isCurrentOrPastMonth) return;
    if (navMonth === 0) {
      setNavMonth(11);
      setNavYear((prev) => prev - 1);
    } else {
      setNavMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (navMonth === 11) {
      setNavMonth(0);
      setNavYear((prev) => prev + 1);
    } else {
      setNavMonth((prev) => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const mm = String(navMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const iso = `${navYear}-${mm}-${dd}`;
    if (iso < todayStr) return;
    setSelectedDate(iso);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedDate || selectedDate < todayStr) {
      return;
    }
    onSelectDate(selectedDate);
  };

  // Friendly human readable date
  const readableSelected = (() => {
    if (!selectedDate) return '';
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return selectedDate;
    }
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="date-popup-heading"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[420px] bg-white rounded-[28px] shadow-[0_25px_70px_-15px_rgba(216,27,96,0.35)] border border-[#F8BBD0] overflow-hidden my-auto transform transition-all p-5 sm:p-6 text-[#4A1525]"
      >
        {/* Soft luxury ambient glows */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-[#FCE7F3]/80 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-[#FFE4E6]/70 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#FFF0F5] border border-[#F8BBD0]/80 flex items-center justify-center text-[#4A1525]/70 hover:text-[#D81B60] hover:bg-[#FFE4E6] transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Heading & Subheading */}
        <div className="space-y-1 mb-4 pr-8">
          <h2
            id="date-popup-heading"
            className="font-editorial text-2xl sm:text-3xl font-bold text-[#4A1525] leading-tight"
          >
            Arey! Ruko Ruko.......
          </h2>
          <p className="text-sm sm:text-base font-semibold text-[#D81B60] leading-snug">
            Lehenge me Slay kab kar rhi ho? Date toh Batado.
          </p>
        </div>

        {/* Interactive Custom Calendar */}
        <div className="bg-[#FFF9FA] border border-[#F8BBD0]/70 rounded-2xl p-3 sm:p-3.5 shadow-inner/20">
          {/* Calendar Month Header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-editorial text-base sm:text-lg font-bold text-[#4A1525]">
              {MONTH_NAMES[navMonth]} {navYear}
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={isCurrentOrPastMonth}
                aria-label="Previous month"
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  isCurrentOrPastMonth
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-[#4A1525] hover:bg-[#F8BBD0]/40 cursor-pointer'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#4A1525] hover:bg-[#F8BBD0]/40 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAYS.map((wd, i) => (
              <span
                key={wd}
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  i === 0 || i === 6 ? 'text-[#D81B60]' : 'text-[#4A1525]/50'
                }`}
              >
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty slots before first day */}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8 sm:h-9" />
            ))}

            {/* Days of the month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const mm = String(navMonth + 1).padStart(2, '0');
              const dd = String(day).padStart(2, '0');
              const iso = `${navYear}-${mm}-${dd}`;
              const isPast = iso < todayStr;
              const isToday = iso === todayStr;
              const isSelected = iso === selectedDate;

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isPast}
                  onClick={() => handleSelectDay(day)}
                  className={`relative h-8 sm:h-9 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center transition-all ${
                    isPast
                      ? 'text-[#4A1525]/20 cursor-not-allowed'
                      : isSelected
                      ? 'bg-gradient-to-tr from-[#D81B60] to-[#E91E63] text-white shadow-md font-bold scale-105 cursor-pointer z-10'
                      : 'text-[#4A1525] hover:bg-[#FFE4E6] hover:text-[#D81B60] cursor-pointer'
                  }`}
                >
                  {day}
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 bg-[#D81B60] rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Hype Readout */}
        <div className="mt-3.5 mb-4 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#FFF0F5] to-[#FFF5F8] border border-[#F8BBD0] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#D81B60]/10 flex items-center justify-center shrink-0 text-[#D81B60]">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#4A1525]/60 block leading-tight">
                Selected Slay Date
              </span>
              <p className="text-xs sm:text-sm font-bold text-[#D81B60] truncate leading-tight">
                {readableSelected}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#D81B60] text-white shrink-0 uppercase tracking-wider">
            Ready
          </span>
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#D81B60] via-[#C2185B] to-[#AD1457] hover:from-[#C2185B] hover:to-[#880E4F] text-white text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shadow-[0_10px_25px_-5px_rgba(216,27,96,0.4)] hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span>Lock In Date & Show Lehengas</span>
        </button>
      </div>
    </div>
  );
};
