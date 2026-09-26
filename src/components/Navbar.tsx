import React, { useState, useEffect } from 'react';
import { Search, ShoppingBag, ChevronDown, Heart, X, Shield } from 'lucide-react';
import { VibeCategory, SiteSettings } from '../types';

interface NavbarProps {
  activeView: 'catalog' | 'admin';
  setActiveView: (view: 'catalog' | 'admin') => void;
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

const CENTER_NAV_LINKS: { label: string; vibe: VibeCategory }[] = [
  { label: 'SANGEET EDIT', vibe: 'Sangeet Main Character' },
  { label: 'HALDI & MEHENDI', vibe: 'Haldi & Sundowner' },
  { label: 'COCKTAIL COUTURE', vibe: 'Cocktail Slay' },
  { label: 'RECEPTION ROYALTY', vibe: 'Reception Royalty' },
  { label: "EX'S SHAADI LOOK", vibe: 'Ex-Cousin Wedding' },
  { label: 'JUST FOR YOU', vibe: 'All Vibes' },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  setActiveView,
  siteSettings,
  selectedVibe,
  onSelectVibe,
  searchQuery,
  onSearchChange,
  onOpenTasksDrawer,
  pendingTasksCount,
  wishlistCount,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (vibe: VibeCategory) => {
    onSelectVibe(vibe);
    if (activeView !== 'catalog') {
      setActiveView('catalog');
    }
    setTimeout(() => {
      document.getElementById('catalog-grid')?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  const useSolidHeader = isScrolled || activeView === 'admin';

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 h-14 sm:h-16 flex items-center transition-all duration-300 ${
        useSolidHeader
          ? 'bg-[#1C1310]/95 backdrop-blur-md shadow-md'
          : 'bg-gradient-to-b from-black/70 via-black/30 to-transparent'
      }`}
    >
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 flex items-center justify-between gap-4">
        {/* Left Brand Mark (Obeys exact Top Logo Size from /admin without stretching the header bar) */}
        <button
          onClick={() => {
            setActiveView('catalog');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="relative flex items-center gap-2.5 text-left focus:outline-none cursor-pointer shrink-0 group py-1"
        >
          {siteSettings.topLogoUrl ? (
            <img
              src={siteSettings.topLogoUrl}
              alt={siteSettings.brandTitle || 'LOL Couture'}
              style={{ height: `${siteSettings.topLogoHeight || 64}px` }}
              className="w-auto max-w-none object-contain transition-all duration-200 drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
            />
          ) : (
            <div
              className="flex items-center gap-2.5 origin-left transition-transform duration-200"
              style={{
                transform: `scale(${(siteSettings.topLogoHeight || 64) / 52})`,
              }}
            >
              <span
                className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5A623] group-hover:text-[#FF7A00] transition-colors leading-none"
                style={{ fontFamily: "'Oswald', sans-serif" }}
              >
                {siteSettings.brandHindiMark || 'लोल'}
              </span>
              <span className="h-6 w-[1.5px] bg-[#F5A623]/70" />
              <div className="flex flex-col">
                <span
                  className="text-lg sm:text-xl font-bold tracking-[0.12em] text-[#F5A623] leading-none"
                  style={{ fontFamily: "'Oswald', sans-serif" }}
                >
                  {siteSettings.brandTitle || 'LOL COUTURE'}
                </span>
                <span className="text-[8.5px] tracking-[0.2em] uppercase text-white/80 mt-0.5 leading-none">
                  {siteSettings.brandSubtitle || 'By Sanjeevani • Indore'}
                </span>
              </div>
            </div>
          )}
        </button>

        {/* Center Category Links */}
        <nav className="hidden xl:flex items-center gap-5">
          {CENTER_NAV_LINKS.map((item) => {
            const isActive =
              activeView === 'catalog' &&
              selectedVibe === item.vibe &&
              item.label !== 'JUST FOR YOU';
            return (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.vibe)}
                className={`text-[10px] tracking-[0.14em] uppercase font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'text-[#F5A623] font-semibold'
                    : 'text-white/90 hover:text-[#F5A623]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right Customer Actions */}
        <div className="flex items-center gap-3 sm:gap-4 text-white">
          {/* Expandable Search Input */}
          {searchOpen ? (
            <div className="flex items-center bg-white/15 backdrop-blur-md border border-white/30 rounded-full px-3 py-1">
              <Search className="w-3 h-3 text-white/70 mr-1.5 shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  if (activeView !== 'catalog') setActiveView('catalog');
                }}
                placeholder="Search lehengas..."
                className="bg-transparent text-[11px] text-white placeholder:text-white/60 focus:outline-none w-28 sm:w-36"
              />
              <button
                onClick={() => {
                  setSearchOpen(false);
                  onSearchChange('');
                }}
                className="text-white/70 hover:text-white ml-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              title="Search Collection"
              className="text-white/90 hover:text-[#F5A623] transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4 stroke-[1.75]" />
            </button>
          )}

          {/* Wishlist Icon (if any saved) */}
          {wishlistCount > 0 && (
            <button
              onClick={() => {
                setActiveView('catalog');
                document.getElementById('catalog-grid')?.scrollIntoView({ behavior: 'smooth' });
              }}
              title="Saved Lehengas"
              className="relative text-white/90 hover:text-[#F5A623] transition-colors cursor-pointer"
            >
              <Heart className="w-4 h-4 fill-[#E85D24] text-[#E85D24]" />
              <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 rounded-full bg-white text-[#1C1310] text-[8px] font-bold flex items-center justify-center">
                {wishlistCount}
              </span>
            </button>
          )}

          {/* Shopping Bag / Bookings Drawer */}
          <button
            onClick={onOpenTasksDrawer}
            title="Your Bookings & Return Schedule"
            className="relative text-white/90 hover:text-[#F5A623] transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 stroke-[1.75]" />
            {pendingTasksCount > 0 && (
              <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 rounded-full bg-[#E11D2A] text-white text-[8px] font-bold flex items-center justify-center">
                {pendingTasksCount}
              </span>
            )}
          </button>

          {/* INR Currency Pill */}
          <button
            onClick={() => {
              document.getElementById('catalog-grid')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-white/40 text-[10px] font-medium tracking-wider text-white hover:border-[#F5A623] hover:text-[#F5A623] transition-colors cursor-pointer"
          >
            <span>INR</span>
            <ChevronDown className="w-3 h-3 opacity-80" />
          </button>

          {/* Show Admin badge only when inside Backend CMS */}
          {activeView === 'admin' && (
            <button
              onClick={() => setActiveView('catalog')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F5A623] text-[#1C1310] text-[10px] font-bold uppercase tracking-wider cursor-pointer"
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
