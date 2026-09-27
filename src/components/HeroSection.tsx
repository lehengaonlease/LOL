import React, { useRef, useEffect } from 'react';
import { LehengaOutfit, VibeCategory, SiteSettings } from '../types';

interface HeroSectionProps {
  featuredOutfit: LehengaOutfit;
  siteSettings: SiteSettings;
  onRentClick: (outfit: LehengaOutfit) => void;
  onShareClick: (outfit: LehengaOutfit) => void;
  onInspectClick: (outfit: LehengaOutfit) => void;
  onSelectVibe: (vibe: VibeCategory) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ siteSettings }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const videoSrc = siteSettings.heroVideoUrl || '/uploads/hero-banner.mp4?v=garba-twirl-v3';
  const posterSrc = siteSettings.heroPosterUrl || '/uploads/hero-poster.jpg';
  const isImageBanner = siteSettings.heroMediaType === 'image';

  // Enforce muted autoplay on mount and whenever videoSrc changes
  useEffect(() => {
    if (isImageBanner) return;
    const video = videoRef.current;
    if (!video) return;

    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;

    const startPlayback = async () => {
      try {
        await video.play();
      } catch {
        video.muted = true;
        try {
          await video.play();
        } catch {
          // Wait for user interaction
        }
      }
    };

    startPlayback();

    const handleUserInteraction = () => {
      if (video.paused) {
        video.muted = true;
        video.play().catch(() => {});
      }
    };

    window.addEventListener('touchstart', handleUserInteraction, { once: true, passive: true });
    window.addEventListener('click', handleUserInteraction, { once: true });

    return () => {
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('click', handleUserInteraction);
    };
  }, [videoSrc, isImageBanner]);

  return (
    <section
      id="hero-banner"
      className="relative w-full pt-16 sm:pt-0 sm:h-screen sm:min-h-[600px] sm:max-h-[960px] overflow-hidden bg-[#FFF5F8] sm:bg-[#2B180A] select-none flex items-center justify-center"
    >
      {/* Muted Looping Video or Image Background — Full Uncropped Width on Mobile */}
      {isImageBanner ? (
        <img
          src={posterSrc}
          alt={siteSettings.brandTitle || 'LOL Couture Banner'}
          className="w-full h-auto object-contain sm:absolute sm:inset-0 sm:w-full sm:h-full sm:object-cover sm:object-center"
        />
      ) : (
        <video
          ref={videoRef}
          key={videoSrc}
          src={videoSrc}
          poster={posterSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onCanPlay={(e) => {
            e.currentTarget.muted = true;
            e.currentTarget.play().catch(() => {});
          }}
          className="w-full h-auto object-contain sm:absolute sm:inset-0 sm:w-full sm:h-full sm:object-cover sm:object-center"
        />
      )}
    </section>
  );
};
