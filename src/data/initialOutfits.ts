import { LehengaOutfit } from '../types';

export const INITIAL_OUTFITS: LehengaOutfit[] = [
  {
    id: 'lol-ind-06',
    code: 'Sunset Orange',
    color: 'Sunset Orange',
    title: "The 'Golden Hour Reel' Sunset Ombre Organza",
    pricePerDay: 1999,
    description:
      'Marigold orange melting into rose pink and copper zari on featherlight organza. Engineered for 120fps slow-mo twirl reels. Wear it once, archive 50 photos, and return it tomorrow.',
    ogHumorTagline:
      'Built for 4K slow-mo twirls, priced at ₹1,999/day. Rent it, break the algorithm, give it back tomorrow! 🌅',
    mediaUrl: '/uploads/lehenga-img-1-1790532186443-umvdi.png',
    mediaType: 'image',
    images: [
      '/uploads/lehenga-img-1-1790532186443-umvdi.png',
      '/uploads/lehenga-img-2-1790532271824-zuxb7.jpg',
    ],
    vibeCategory: 'Haldi & Sundowner',
    sizes: ['XS', 'S', 'M', 'L'],
    available: true,
    createdAt: '2026-09-25T12:00:00.000Z',
    videoUrl: '/lehenga-reel.mp4',
  },
];
