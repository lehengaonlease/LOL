import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, ArrowDown } from 'lucide-react';
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
  const [isMuted, setIsMuted] = useState(true);
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
    video.muted = isMuted;
    video.playsInline = true;

    const startPlayback = async () => {
      try {
        await video.play();
      } catch {
        video.muted = true;
        setIsMuted(true);
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

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const scrollToCatalog = () => {
    document.getElementById('catalog-grid')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative w-full h-screen min-h-[640px] max-h-[960px] overflow-hidden bg-[#2B180A] select-none">
      {/* Full-Bleed Muted Looping Video or Image Background (Managed strictly via /admin Backend) */}
      {isImageBanner ? (
        <img
          src={posterSrc}
          alt={siteSettings.brandTitle || 'LOL Couture Banner'}
          className="absolute inset-0 w-full h-full object-cover object-center scale-[1.01]"
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
            e.currentTarget.muted = isMuted;
            e.currentTarget.play().catch(() => {});
          }}
          className="absolute inset-0 w-full h-full object-cover object-center scale-[1.02] transition-transform duration-700"
        />
      )}

      {/* Subtle Top & Bottom Vignette for Header & Scroll Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/35 pointer-events-none" />

      {/* Customer-Only Bottom Bar: Sound Toggle + Scroll To Collection */}
      <div className="absolute bottom-5 left-4 sm:left-8 right-4 sm:right-8 z-20 flex items-center justify-between">
        {/* Left: Subtle Mute/Unmute Toggle (No upload or edit buttons on public frontend) */}
        <div>
          {!isImageBanner && (
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="p-2.5 rounded-full bg-black/45 hover:bg-black/75 backdrop-blur-md border border-white/20 text-white/90 transition-all cursor-pointer"
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Center Scroll Down Indicator */}
        <button
          onClick={scrollToCatalog}
          className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/85 hover:text-white transition-colors cursor-pointer"
        >
          <span>Scroll To Collection</span>
          <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
        </button>

        {/* Right: 24-Hr Policy Note */}
        <div className="hidden sm:block text-[11px] font-semibold tracking-wider text-white/80 uppercase">
          *24-Hr Return T&C Apply
        </div>
      </div>
    </section>
  );
};
