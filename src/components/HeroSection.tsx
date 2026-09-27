import React from 'react';
import { LehengaOutfit, VibeCategory, SiteSettings } from '../types';
import { VideoPlayer, resolvePublicVideoPath } from './VideoPlayer';

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
  const posterSrc = resolvePublicVideoPath(siteSettings.heroPosterUrl || '/uploads/hero-poster.jpg');
  const isImageBanner = siteSettings.heroMediaType === 'image';

  return (
    <section
      id="hero-banner"
      className="relative w-full mt-16 sm:mt-0 aspect-[9/16] sm:aspect-auto sm:h-screen sm:min-h-[600px] sm:max-h-[960px] overflow-hidden bg-[#2B180A] select-none"
    >
      {isImageBanner ? (
        <img
          src={posterSrc}
          alt={siteSettings.brandTitle || 'LOL Couture Banner'}
          className="w-full h-full object-cover object-center"
        />
      ) : (
        <VideoPlayer
          src={videoSrc}
          poster={posterSrc}
          fallbackSrc="/hero-banner.mp4"
          className="w-full h-full object-cover object-center"
        />
      )}
    </section>
  );
};
