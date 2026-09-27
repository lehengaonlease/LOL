export type MediaType = 'image' | 'video';

export type VibeCategory = string;

export interface LehengaOutfit {
  id: string;
  code: string;
  title: string;
  pricePerDay: number;
  description: string;
  ogHumorTagline: string;
  mediaUrl: string;
  mediaType: MediaType;
  images?: string[];
  videoUrl?: string;
  galleryUrls?: string[];
  vibeCategory: string;
  sizes: string[];
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
  curatedCollectionTitle?: string;
  catalogSectionKicker?: string;
  catalogSectionTitle?: string;
  catalogSectionSubtitle?: string;
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

export interface CustomerTestimonial {
  id: string;
  customerName: string;
  indoreLocation: string;
  rating: number;
  quote: string;
  photoUrl: string;
  outfitCode?: string;
  createdAt: string;
}
