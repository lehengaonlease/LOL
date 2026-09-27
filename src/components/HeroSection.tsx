import React from 'react';
import { LehengaOutfit, VibeCategory, SiteSettings } from '../types';
import { VideoPlayer, resolvePublicVideoPath } from './VideoPlayer';
import { OptimizedImage, resolveOptimizedImagePath } from './OptimizedImage';

interface HeroSectionProps {
  featuredOutfit: LehengaOutfit;
  siteSettings: SiteSettings;
  onRentClick: (outfit: LehengaOutfit) => void;
  onShareClick: (outfit: LehengaOutfit) => void;
  onInspectClick: (outfit: LehengaOutfit) => void;
  onSelectVibe: (vibe: VibeCategory) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ siteSettings }) => {
  const videoSrc = resolvePublicVideoPath(siteSettings.heroVideoUrl || '/hero-banner.mp4');
  const posterSrc = resolveOptimizedImagePath(siteSettings.heroPosterUrl || '/uploads/hero-poster.jpg');
  const isImageBanner = siteSettings.heroMediaType === 'image';

  return (
    <section
      id="hero-banner"
      className="relative w-full pt-16 sm:pt-0 sm:h-screen sm:min-h-[600px] sm:max-h-[960px] overflow-hidden bg-[#FFF5F8] sm:bg-[#2B180A] select-none flex items-center justify-center"
    >
      {/* Muted Looping Video or Image Background — Full Uncropped Width on Mobile */}
      {isImageBanner ? (
        <OptimizedImage
          src={posterSrc}
          alt={siteSettings.brandTitle || 'LOL Couture Banner'}
          priority
          className="w-full h-auto object-contain sm:absolute sm:inset-0 sm:w-full sm:h-full sm:object-cover sm:object-center"
        />
      ) : (
        <VideoPlayer
          src={videoSrc}
          poster={posterSrc}
          fallbackSrc="/hero-banner.mp4"
          className="w-full h-auto object-contain sm:absolute sm:inset-0 sm:w-full sm:h-full sm:object-cover sm:object-center"
        />
      )}
    </section>
  );
};
