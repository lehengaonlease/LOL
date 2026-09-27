import React, { useState, useEffect } from 'react';
import { Heart, Shield } from 'lucide-react';
import { VibeCategory, SiteSettings } from '../types';
import { OptimizedImage } from './OptimizedImage';

interface NavbarProps {
  activeView: 'catalog' | 'admin';
  setActiveView: (view: 'catalog' | 'admin') => void;
  isOutfitPage?: boolean;
  siteSettings: SiteSettings;
  selectedVibe: VibeCategory;
  onSelectVibe: (vibe: VibeCategory) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenTasksDrawer: () => void;
  isTasksConnected: boolean;
  pendingTasksCount: number;
  totalOutfitsCount: number;
  wishlistCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  setActiveView,
  isOutfitPage = false,
  siteSettings,
  wishlistCount,
}) => {
  const [isPastBanner, setIsPastBanner] = useState(false);

  useEffect(() => {
    const checkScrollPosition = () => {
      const heroBanner = document.getElementById('hero-banner');
      const headerHeight = 64;
      if (heroBanner) {
        const rect = heroBanner.getBoundingClientRect();
        setIsPastBanner(rect.bottom <= headerHeight);
      } else {
        setIsPastBanner(true);
      }
    };

    checkScrollPosition();
    window.addEventListener('scroll', checkScrollPosition, { passive: true });
    window.addEventListener('resize', checkScrollPosition, { passive: true });
    return () => {
      window.removeEventListener('scroll', checkScrollPosition);
      window.removeEventListener('resize', checkScrollPosition);
    };
  }, [activeView, isOutfitPage]);

  const useSolidHeader = isPastBanner || activeView === 'admin' || isOutfitPage;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 h-16 sm:h-20 flex items-center transition-all duration-300 ${
        useSolidHeader
          ? 'bg-[#FFF0F5]/95 backdrop-blur-md border-b border-[#F8BBD0] shadow-sm'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="relative w-full max-w-[1400px] mx-auto px-4 sm:px-8 flex items-center justify-center">
        {/* Centered Top Brand Logo */}
        <button
          onClick={() => {
            setActiveView('catalog');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="relative flex items-center justify-center gap-2.5 text-center focus:outline-none cursor-pointer shrink-0 group py-1"
        >
          {siteSettings.topLogoUrl ? (
            <OptimizedImage
              src={siteSettings.topLogoUrl}
              alt={siteSettings.brandTitle || 'LOL Couture'}
              priority
              isLogo
              style={{ height: `${siteSettings.topLogoHeight || 64}px` }}
              className="w-auto max-h-14 sm:max-h-18 object-contain transition-all duration-200 mx-auto"
            />
          ) : (
            <div
              className="flex items-center gap-2.5 origin-center transition-transform duration-200"
              style={{
                transform: `scale(${(siteSettings.topLogoHeight || 64) / 52})`,
              }}
            >
              <span className="font-editorial text-2xl sm:text-3xl font-bold tracking-tight text-[#D81B60] group-hover:text-[#AD1457] transition-colors leading-none">
                {siteSettings.brandHindiMark || 'लोल'}
              </span>
              <span className="h-6 w-[1.5px] bg-[#F48FB1]" />
              <div className="flex flex-col text-left">
                <span className="font-editorial text-lg sm:text-xl font-bold tracking-[0.12em] text-[#4A1525] leading-none">
                  {siteSettings.brandTitle || 'LOL COUTURE'}
                </span>
                <span className="text-[8.5px] tracking-[0.2em] uppercase text-[#880E4F]/75 mt-0.5 leading-none">
                  {siteSettings.brandSubtitle || 'By Sanjeevani • Indore'}
                </span>
              </div>
            </div>
          )}
        </button>

        {/* Optional Right Badges (Wishlist if active, or Exit Admin when inside Backend CMS) */}
        <div className="absolute right-4 sm:right-8 flex items-center gap-2.5 sm:gap-3.5 text-[#4A1525]">
          {wishlistCount > 0 && (
            <button
              onClick={() => {
                setActiveView('catalog');
                document.getElementById('catalog-grid')?.scrollIntoView({ behavior: 'smooth' });
              }}
              title="Saved Lehengas"
              className="relative text-[#4A1525]/85 hover:text-[#D81B60] transition-colors cursor-pointer"
            >
              <Heart className="w-4 h-4 fill-[#D81B60] text-[#D81B60]" />
              <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 rounded-full bg-[#D81B60] text-white text-[8px] font-bold flex items-center justify-center">
                {wishlistCount}
              </span>
            </button>
          )}

          {activeView === 'admin' && (
            <button
              onClick={() => setActiveView('catalog')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#D81B60] text-white text-[10px] font-bold uppercase tracking-wider cursor-pointer"
            >
              <Shield className="w-3 h-3" />
              <span>Exit Admin</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
