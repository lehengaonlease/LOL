export type MediaType = 'image' | 'video';

export type VibeCategory = string;

export interface LehengaOutfit {
  id: string;
  code: string;
  color?: string;
  title: string;
  pricePerDay: number;
  description: string;
  ogHumorTagline: string;
  mediaUrl: string;
  mediaType: MediaType;
  mediaUrls?: string[];
  images?: string[];
  videoUrl?: string;
  galleryUrls?: string[];
  vibeCategory: string;
  sizes: string[];
  available: boolean;
  createdAt?: string;
  retailPrice?: number;
  originalRetailPrice?: number;
  sortOrder?: number;
  featured?: boolean;
  bookedDates?: string[];
  updatedAt?: number | string;
}

export interface LehengaColorOption {
  label: string;
  swatch: string;
}

export const LEHENGA_COLOR_OPTIONS: LehengaColorOption[] = [
  { label: 'Rani Pink', swatch: '#D81B60' },
  { label: 'Sunset Orange', swatch: '#EA580C' },
  { label: 'Crimson Red', swatch: '#DC2626' },
  { label: 'Haldi Yellow', swatch: '#EAB308' },
  { label: 'Emerald Green', swatch: '#059669' },
  { label: 'Royal Blue', swatch: '#2563EB' },
  { label: 'Wine Maroon', swatch: '#7F1D1D' },
  { label: 'Pastel Blush', swatch: '#F472B6' },
  { label: 'Ivory Gold', swatch: '#D4AF37' },
  { label: 'Lavender Lilac', swatch: '#A855F7' },
  { label: 'Midnight Black', swatch: '#18181B' },
  { label: 'Multi-Colour', swatch: 'linear-gradient(135deg, #D81B60, #F59E0B, #2563EB)' },
];

export function resolveOutfitColor(rawCodeOrColor?: string): string {
  const cleaned = (rawCodeOrColor || '').trim();
  if (!cleaned || /^LOL-IND/i.test(cleaned)) {
    return 'Sunset Orange';
  }
  const matched = LEHENGA_COLOR_OPTIONS.find(
    (opt) => opt.label.toLowerCase() === cleaned.toLowerCase()
  );
  return matched ? matched.label : cleaned;
}

export function getOutfitColorSwatch(colorLabel?: string): string {
  const resolved = resolveOutfitColor(colorLabel);
  const matched = LEHENGA_COLOR_OPTIONS.find(
    (opt) => opt.label.toLowerCase() === resolved.toLowerCase()
  );
  return matched ? matched.swatch : '#D81B60';
}

export interface CouponCodeItem {
  id: string;
  code: string;
  discountPercent: number;
  enabled: boolean;
}

export interface SiteSettings {
  topLogoUrl: string; // Empty string uses default vector/text lockup, or custom uploaded image URL
  bottomLogoUrl: string; // Empty string uses default vector/text lockup, or custom uploaded image URL
  topLogoHeight: number; // Height in px for top navbar logo (default 56)
  bottomLogoHeight: number; // Height in px for bottom footer logo (default 88)
  brandHindiMark: string;
  brandTitle: string;
  brandSubtitle: string;
  heroMediaType: 'video' | 'image';
  heroVideoUrl: string;
  heroPosterUrl: string;
  footerDescription: string;
  studioLocation: string;
  whatsappNumber: string;
  curatedCollectionTitle?: string;
  catalogSectionKicker?: string;
  catalogSectionTitle?: string;
  catalogSectionSubtitle?: string;
  couponCode?: string;
  couponDiscountPercent?: number;
  couponEnabled?: boolean;
  coupons?: CouponCodeItem[];
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  topLogoUrl: '/uploads/logo-top-1790531566115-6ys4f.png',
  bottomLogoUrl: '/uploads/logo-bottom-1790531569272-mgmg7.png',
  topLogoHeight: 102,
  bottomLogoHeight: 200,
  brandHindiMark: 'लोल',
  brandTitle: 'LOL',
  brandSubtitle: 'Want it . Rent it',
  heroMediaType: 'video',
  heroVideoUrl: '/hero-banner.mp4',
  heroPosterUrl: '/uploads/hero-poster.jpg',
  footerDescription:
    'At LOL By Sanjeevani, we are entirely obsessed with making you look like a million bucks on and off the feed. Our collection is meticulously handpicked to deliver pure main-character energy for every grand wedding, sangeet night, and high-energy festival in Indore. We refresh our racks constantly, ensuring you always stay three steps ahead of the trends.',
  studioLocation: 'Anantnath apartment, Silicon city, indore',
  whatsappNumber: '7000861465',
  curatedCollectionTitle: 'Navratri Ni Pehvesh',
  catalogSectionKicker: '10/10 MANDAL VIBES ONLY',
  catalogSectionTitle: 'The Garba Night Essentials',
  catalogSectionSubtitle:
    "Every piece is custom-fitted to survive your wildest Garba steps, Heavy mirror work, vibrant traditional prints, and massive custom-altered flares that demand a slow-mo reel. Sanitized, perfectly fitted to your waist, and ready to sweep Indore's biggest grounds.",
  couponCode: 'LOL10',
  couponDiscountPercent: 10,
  couponEnabled: true,
  coupons: [
    {
      id: 'coupon-default-1',
      code: 'LOL10',
      discountPercent: 10,
      enabled: true,
    },
  ],
};

export function getNormalizedCoupons(settings?: SiteSettings): CouponCodeItem[] {
  if (!settings) return DEFAULT_SITE_SETTINGS.coupons || [];
  if (Array.isArray(settings.coupons) && settings.coupons.length > 0) {
    return settings.coupons;
  }
  if (settings.couponCode && settings.couponCode.trim()) {
    return [
      {
        id: 'coupon-primary',
        code: settings.couponCode.trim().toUpperCase(),
        discountPercent: Math.max(1, Math.min(99, Number(settings.couponDiscountPercent) || 10)),
        enabled: settings.couponEnabled !== false,
      },
    ];
  }
  return [];
}

export function findMatchingActiveCoupon(
  rawInput: string,
  settings?: SiteSettings
): CouponCodeItem | null {
  const clean = (rawInput || '').trim().toUpperCase();
  if (!clean) return null;
  const list = getNormalizedCoupons(settings);
  const found = list.find(
    (c) => c.enabled && c.code.trim().toUpperCase() === clean && c.discountPercent > 0
  );
  return found || null;
}

export function normalizeStudioWhatsAppDisplay(raw?: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits || digits.includes('9826000000')) {
    return '7000861465';
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  return digits;
}

export function formatWhatsAppUrlNumber(raw?: string): string {
  const display = normalizeStudioWhatsAppDisplay(raw);
  return display.length === 10 ? `91${display}` : display;
}

export interface RentalBooking {
  id: string;
  outfitId: string;
  outfitCode: string;
  outfitTitle: string;
  pricePerDay: number;
  rentalDate: string;
  returnDate: string;
  pickupTime: string;
  customerName: string;
  customerPhone: string;
  promisedNextDayReturn: boolean;
  createdAt: string;
  syncedToGoogleTasks?: boolean;
}

export function isOutfitBookedOnDate(
  outfit: LehengaOutfit,
  dateStr: string,
  bookings: RentalBooking[]
): boolean {
  if (!outfit) return false;
  if (outfit.available === false) return true;
  if (Array.isArray(outfit.bookedDates) && outfit.bookedDates.includes(dateStr)) {
    return true;
  }
  if (!dateStr || !Array.isArray(bookings)) return false;

  return bookings.some((b) => {
    const isSame =
      b.outfitId === outfit.id ||
      (Boolean(b.outfitCode && outfit.code) &&
        b.outfitCode.trim().toUpperCase() === outfit.code.trim().toUpperCase());
    if (!isSame) return false;

    const rStart = b.rentalDate;
    const rEnd = b.returnDate || b.rentalDate;
    if (rStart && rEnd) {
      return dateStr >= rStart && dateStr <= rEnd;
    }
    return dateStr === rStart;
  });
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d} ${months[date.getMonth()]}`;
  } catch {
    return dateStr;
  }
}

export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  updated?: string;
}

export interface RentalBookingDraft {
  outfit: LehengaOutfit;
  customerName: string;
  customerPhone: string;
  eventDate: string;
  returnDate: string;
  agreedToNextDayReturn: boolean;
}

export interface StudioTaskReminder {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  status: 'needsAction' | 'completed';
  outfitCode?: string;
}

export interface CustomerTestimonial {
  id: string;
  customerName: string;
  indoreLocation: string;
  rating: number;
  quote: string;
  photoUrl: string;
  outfitCode?: string;
  createdAt: string;
  adminReply?: string;
  adminRepliedAt?: string;
}
