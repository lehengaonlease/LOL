export type MediaType = 'image' | 'video';

export type VibeCategory =
  | 'All Vibes'
  | 'Sangeet Main Character'
  | 'Haldi & Sundowner'
  | 'Cocktail Slay'
  | 'Reception Royalty'
  | 'Ex-Cousin Wedding';

export interface LehengaOutfit {
  id: string;
  code: string;
  title: string;
  pricePerDay: number;
  retailPrice: number;
  description: string;
  ogHumorTagline: string;
  mediaUrl: string;
  mediaType: MediaType;
  galleryUrls?: string[];
  vibeCategory: Exclude<VibeCategory, 'All Vibes'>;
  sizes: string[];
  indoreHotspot: string;
  available: boolean;
  createdAt: string;
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
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  topLogoUrl: '',
  bottomLogoUrl: '',
  topLogoHeight: 56,
  bottomLogoHeight: 88,
  brandHindiMark: 'लोल',
  brandTitle: 'LOL COUTURE',
  brandSubtitle: 'By Sanjeevani • Indore',
  heroMediaType: 'video',
  heroVideoUrl: '/uploads/hero-banner.mp4?v=garba-twirl-v3',
  heroPosterUrl: '/uploads/hero-poster.jpg',
  footerDescription:
    'LOL (Lehenga On Lease) By Sanjeevani is Indore’s premier luxury bridal and festive wear rental studio. Wear ₹60,000+ designer silhouettes starting at ₹1,999/day.',
  studioLocation: 'Vijay Nagar & Saket, Indore',
  whatsappNumber: '919826000000',
};

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
