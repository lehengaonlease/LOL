import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Heart,
  ArrowUpDown,
  PhoneCall,
  MapPin,
  ShieldCheck,
  Clock,
  Ruler,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { INITIAL_OUTFITS } from './data/initialOutfits';
import {
  LehengaOutfit,
  VibeCategory,
  RentalBookingDraft,
  StudioTaskReminder,
  SiteSettings,
  DEFAULT_SITE_SETTINGS,
} from './types';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { ProductCard } from './components/ProductCard';
import { LookbookModal } from './components/LookbookModal';
import { RentalModal } from './components/RentalModal';
import { ShareModal } from './components/ShareModal';
import { AdminDashboard } from './components/AdminDashboard';
import { GoogleTasksDrawer } from './components/GoogleTasksDrawer';
import { LolBrandLogo } from './components/LolBrandLogo';
import {
  requestGoogleTasksToken,
  getStoredAccessToken,
  ensureLolTaskList,
  listTasks,
  createTask,
  toggleTaskStatus,
} from './services/googleTasksService';

const STORAGE_KEY_OUTFITS = 'lol_indore_outfits_v2';
const STORAGE_KEY_TASKS = 'lol_indore_tasks_v2';
const STORAGE_KEY_WISHLIST = 'lol_indore_wishlist_v2';
const STORAGE_KEY_SITE_SETTINGS = 'lol_indore_site_settings_v1';

const VIBE_FILTERS: { label: string; value: VibeCategory }[] = [
  { label: 'All Couture', value: 'All Vibes' },
  { label: 'Sangeet Edit', value: 'Sangeet Main Character' },
  { label: 'Haldi & Mehendi', value: 'Haldi & Sundowner' },
  { label: 'Cocktail Couture', value: 'Cocktail Slay' },
  { label: 'Reception Royalty', value: 'Reception Royalty' },
  { label: "Ex's Shaadi Edit", value: 'Ex-Cousin Wedding' },
];

function detectInitialView(): 'catalog' | 'admin' {
  const pathname = window.location.pathname.toLowerCase();
  const search = window.location.search.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  if (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    search.includes('view=admin') ||
    search.includes('admin=1') ||
    hash === '#admin'
  ) {
    return 'admin';
  }
  return 'catalog';
}

export function App() {
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SITE_SETTINGS);
      if (saved) {
        return { ...DEFAULT_SITE_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SITE_SETTINGS;
  });

  const [outfits, setOutfits] = useState<LehengaOutfit[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_OUTFITS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_OUTFITS;
  });

  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WISHLIST);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [localTasks, setLocalTasks] = useState<StudioTaskReminder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TASKS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeView, setActiveViewState] = useState<'catalog' | 'admin'>(detectInitialView);
  const [selectedVibe, setSelectedVibe] = useState<VibeCategory>('All Vibes');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'savings-desc'>('featured');
  const [showWishlistOnly, setShowWishlistOnly] = useState(false);

  // Sync URL path (/ vs /admin) with activeView
  const setActiveView = (view: 'catalog' | 'admin') => {
    setActiveViewState(view);
    try {
      const nextUrl = view === 'admin' ? '/admin' : '/';
      if (window.location.pathname !== nextUrl) {
        window.history.pushState({}, '', nextUrl);
      }
    } catch {
      // ignore in restricted iframe history environments
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveViewState(detectInitialView());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load site settings from backend API on mount
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          const merged = { ...DEFAULT_SITE_SETTINGS, ...data };
          setSiteSettings(merged);
          localStorage.setItem(STORAGE_KEY_SITE_SETTINGS, JSON.stringify(merged));
        }
      })
      .catch(() => {});
  }, []);

  // Modals
  const [inspectOutfit, setInspectOutfit] = useState<LehengaOutfit | null>(null);
  const [rentalOutfit, setRentalOutfit] = useState<LehengaOutfit | null>(null);
  const [shareOutfit, setShareOutfit] = useState<LehengaOutfit | null>(null);
  const [isTasksDrawerOpen, setIsTasksDrawerOpen] = useState(false);

  // Google Tasks OAuth state
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() =>
    getStoredAccessToken()
  );
  const [googleTaskListId, setGoogleTaskListId] = useState<string>('@default');
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isLoadingGoogleTasks, setIsLoadingGoogleTasks] = useState(false);
  const [googleTasksError, setGoogleTasksError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_OUTFITS, JSON.stringify(outfits));
    } catch {
      // ignore
    }
  }, [outfits]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WISHLIST, JSON.stringify(wishlist));
    } catch {
      // ignore
    }
  }, [wishlist]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(localTasks));
    } catch {
      // ignore
    }
  }, [localTasks]);

  // Deep link support (?outfit=LOL-IND-01)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outfitCode = params.get('outfit');
    if (outfitCode) {
      const found = outfits.find(
        (o) => o.code.toLowerCase() === outfitCode.toLowerCase()
      );
      if (found) {
        setInspectOutfit(found);
      }
    }
  }, [outfits]);

  const handleUpdateSiteSettings = async (nextSettings: SiteSettings) => {
    setSiteSettings(nextSettings);
    try {
      localStorage.setItem(STORAGE_KEY_SITE_SETTINGS, JSON.stringify(nextSettings));
    } catch {
      // ignore
    }
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextSettings),
      });
      if (res.ok) {
        const saved = await res.json();
        setSiteSettings(saved);
        localStorage.setItem(STORAGE_KEY_SITE_SETTINGS, JSON.stringify(saved));
      }
    } catch {
      // fallback to localStorage
    }
  };

  const handleToggleWishlist = (id: string) => {
    setWishlist((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredOutfits = useMemo(() => {
    return outfits
      .filter((item) => {
        if (showWishlistOnly && !wishlist.includes(item.id)) return false;
        if (selectedVibe !== 'All Vibes' && item.vibeCategory !== selectedVibe) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchCode = item.code.toLowerCase().includes(q);
          const matchDesc = item.description.toLowerCase().includes(q);
          const matchVibe = item.vibeCategory.toLowerCase().includes(q);
          return matchTitle || matchCode || matchDesc || matchVibe;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.pricePerDay - b.pricePerDay;
        if (sortBy === 'savings-desc') {
          return b.retailPrice - b.pricePerDay - (a.retailPrice - a.pricePerDay);
        }
        return 0;
      });
  }, [outfits, selectedVibe, searchQuery, sortBy, showWishlistOnly, wishlist]);

  // Connect Google Tasks
  const handleConnectGoogleTasks = async () => {
    setIsConnectingGoogle(true);
    setGoogleTasksError(null);
    try {
      const token = await requestGoogleTasksToken('consent');
      setGoogleAccessToken(token);
      setIsLoadingGoogleTasks(true);
      const list = await ensureLolTaskList(token);
      setGoogleTaskListId(list.id);
      const remoteTasks = await listTasks(token, list.id);
      setLocalTasks(remoteTasks);
    } catch (err) {
      setGoogleTasksError(
        err instanceof Error ? err.message : 'Failed to connect to Google Tasks.'
      );
    } finally {
      setIsConnectingGoogle(false);
      setIsLoadingGoogleTasks(false);
    }
  };

  const handleRefreshGoogleTasks = async () => {
    if (!googleAccessToken) return;
    setIsLoadingGoogleTasks(true);
    setGoogleTasksError(null);
    try {
      const list = await ensureLolTaskList(googleAccessToken);
      setGoogleTaskListId(list.id);
      const remoteTasks = await listTasks(googleAccessToken, list.id);
      setLocalTasks(remoteTasks);
    } catch (err) {
      setGoogleTasksError(
        err instanceof Error ? err.message : 'Could not refresh Google Tasks.'
      );
    } finally {
      setIsLoadingGoogleTasks(false);
    }
  };

  const handleConfirmBooking = async (
    booking: RentalBookingDraft,
    syncToGoogleTasks: boolean
  ) => {
    const taskTitle = `Return ${booking.outfit.code} (${booking.outfit.title}) — Guest: ${booking.customerName}`;
    const taskNotes = `24-Hr Next-Day Return Policy Confirmed. Event Date: ${booking.eventDate} | Return & Steam-Sanitize Due: ${booking.returnDate} by 6:00 PM. Phone: ${booking.customerPhone}`;

    if (syncToGoogleTasks && googleAccessToken) {
      const created = await createTask(googleAccessToken, googleTaskListId, {
        title: taskTitle,
        notes: taskNotes,
        due: booking.returnDate,
      });
      setLocalTasks((prev) => [created, ...prev]);
    } else if (syncToGoogleTasks) {
      const localTask: StudioTaskReminder = {
        id: `local-task-${Date.now()}`,
        title: taskTitle,
        notes: taskNotes,
        due: booking.returnDate,
        status: 'needsAction',
        outfitCode: booking.outfit.code,
      };
      setLocalTasks((prev) => [localTask, ...prev]);
    }
  };

  const handleToggleTaskStatus = async (task: StudioTaskReminder) => {
    const nextCompleted = task.status !== 'completed';
    if (googleAccessToken && !task.id.startsWith('local-task-')) {
      try {
        await toggleTaskStatus(googleAccessToken, googleTaskListId, task.id, nextCompleted);
      } catch {
        // fallback local update
      }
    }
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: nextCompleted ? 'completed' : 'needsAction' }
          : t
      )
    );
  };

  const handleCreateSampleTask = async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueStr = tomorrow.toISOString().split('T')[0];

    const sampleTitle = `Next-Day Return & Steam Clean: LOL-IND-01 (Burnt Tangerine Zardosi)`;
    const sampleNotes = `Collect outfit by 6:00 PM at Vijay Nagar Studio and run hospital-grade steam sanitization.`;

    if (googleAccessToken) {
      try {
        const created = await createTask(googleAccessToken, googleTaskListId, {
          title: sampleTitle,
          notes: sampleNotes,
          due: dueStr,
        });
        setLocalTasks((prev) => [created, ...prev]);
        return;
      } catch {
        // fallback local
      }
    }

    setLocalTasks((prev) => [
      {
        id: `local-task-${Date.now()}`,
        title: sampleTitle,
        notes: sampleNotes,
        due: dueStr,
        status: 'needsAction',
        outfitCode: 'LOL-IND-01',
      },
      ...prev,
    ]);
  };

  const pendingTasksCount = localTasks.filter((t) => t.status !== 'completed').length;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1C1310]">
      {/* Sticky Minimalist Luxury Header */}
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        siteSettings={siteSettings}
        selectedVibe={selectedVibe}
        onSelectVibe={setSelectedVibe}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenTasksDrawer={() => setIsTasksDrawerOpen(true)}
        isTasksConnected={Boolean(googleAccessToken)}
        pendingTasksCount={pendingTasksCount}
        totalOutfitsCount={outfits.length}
        wishlistCount={wishlist.length}
      />

      {activeView === 'admin' ? (
        <main className="flex-1 pt-20">
          <AdminDashboard
            outfits={outfits}
            siteSettings={siteSettings}
            onUpdateSiteSettings={handleUpdateSiteSettings}
            onAddOutfit={(newOutfit) => setOutfits((prev) => [newOutfit, ...prev])}
            onUpdateOutfit={(updated) =>
              setOutfits((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
            }
            onDeleteOutfit={(id) => setOutfits((prev) => prev.filter((o) => o.id !== id))}
            onResetCatalog={() => setOutfits(INITIAL_OUTFITS)}
            onBackToCatalog={() => setActiveView('catalog')}
          />
        </main>
      ) : (
        <main className="flex-1">
          {/* Customer-Facing Full-Screen Hero Banner (No edit controls) */}
          <HeroSection
            featuredOutfit={outfits[0] || INITIAL_OUTFITS[0]}
            siteSettings={siteSettings}
            onRentClick={(outfit) => setRentalOutfit(outfit)}
            onShareClick={(outfit) => setShareOutfit(outfit)}
            onInspectClick={(outfit) => setInspectOutfit(outfit)}
            onSelectVibe={(vibe) => setSelectedVibe(vibe)}
          />

          {/* Main Couture Collection Section */}
          <section
            id="catalog-grid"
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20"
          >
            {/* Section Title & Subtitle */}
            <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
              <span className="text-[11px] uppercase tracking-[0.22em] text-[#E85D24] font-semibold block">
                Curated Bridal & Festive Edit
              </span>
              <h2 className="font-editorial text-3xl sm:text-5xl font-semibold text-[#1C1310] tracking-tight">
                The Lehenga Collection
              </h2>
              <p className="text-xs sm:text-sm text-[#1C1310]/65">
                Every piece is custom-fitted to your waist & blouse measurements, steam-sanitized,
                and ready for pickup or delivery in Indore.
              </p>
            </div>

            {/* Clean Filter & Sort Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 mb-8 border-b border-[#1C1310]/10">
              {/* Occasion Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                {VIBE_FILTERS.map((tab) => {
                  const active = selectedVibe === tab.value && !showWishlistOnly;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => {
                        setShowWishlistOnly(false);
                        setSelectedVibe(tab.value);
                      }}
                      className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                        active
                          ? 'bg-[#1C1310] text-white'
                          : 'bg-white text-[#1C1310]/70 hover:text-[#1C1310] border border-[#1C1310]/10'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}

                {wishlist.length > 0 && (
                  <button
                    onClick={() => setShowWishlistOnly(!showWishlistOnly)}
                    className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                      showWishlistOnly
                        ? 'bg-[#E85D24] text-white'
                        : 'bg-white text-[#1C1310]/75 border border-[#1C1310]/10'
                    }`}
                  >
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    <span>Saved ({wishlist.length})</span>
                  </button>
                )}
              </div>

              {/* Right Sort Control */}
              <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                <span className="text-xs text-[#1C1310]/55">
                  Showing <strong className="text-[#1C1310]">{filteredOutfits.length}</strong> designs
                </span>

                <div className="relative inline-flex items-center">
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#1C1310]/45 absolute left-3 pointer-events-none" />
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as 'featured' | 'price-asc' | 'savings-desc')
                    }
                    className="pl-8 pr-4 py-2 rounded-full bg-white border border-[#1C1310]/12 text-xs font-medium text-[#1C1310] focus:outline-none focus:border-[#1C1310]/40 cursor-pointer"
                  >
                    <option value="featured">Sort: Featured</option>
                    <option value="price-asc">Rent: Low to High</option>
                    <option value="savings-desc">Biggest Retail Savings</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Product Grid (3 Columns on Desktop — Full 3:4 Portrait Cards) */}
            {filteredOutfits.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-[#1C1310]/8 p-8">
                <Sparkles className="w-8 h-8 text-[#E85D24] mx-auto mb-3" />
                <h3 className="font-editorial text-2xl font-semibold text-[#1C1310]">
                  No matching lehengas found
                </h3>
                <p className="text-xs text-[#1C1310]/60 mt-1 mb-5">
                  Try clearing your search filter or exploring all occasion edits.
                </p>
                <button
                  onClick={() => {
                    setSelectedVibe('All Vibes');
                    setSearchQuery('');
                    setShowWishlistOnly(false);
                  }}
                  className="px-6 py-2.5 rounded-full bg-[#1C1310] text-white text-xs uppercase tracking-wider font-semibold hover:bg-[#E85D24] transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7 lg:gap-8">
                {filteredOutfits.map((outfit) => (
                  <ProductCard
                    key={outfit.id}
                    outfit={outfit}
                    onRent={(o) => setRentalOutfit(o)}
                    onShare={(o) => setShareOutfit(o)}
                    onInspect={(o) => setInspectOutfit(o)}
                    isWishlisted={wishlist.includes(outfit.id)}
                    onToggleWishlist={handleToggleWishlist}
                  />
                ))}
              </div>
            )}
          </section>

          {/* How Our 24-Hour Couture Lease Works */}
          <section className="bg-white border-y border-[#1C1310]/10 py-16 sm:py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-xl mx-auto mb-12">
                <span className="text-[11px] uppercase tracking-[0.22em] text-[#E85D24] font-semibold block">
                  Effortless Luxury
                </span>
                <h2 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#1C1310] mt-1">
                  How Lehenga On Lease Works
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="p-6 rounded-2xl bg-[#FAF8F5] border border-[#1C1310]/8 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-[#1C1310] text-white flex items-center justify-center">
                    <Ruler className="w-4 h-4 text-[#E85D24]" />
                  </div>
                  <span className="text-[10px] font-mono-num uppercase tracking-widest text-[#1C1310]/50 font-semibold block">
                    Step 01
                  </span>
                  <h3 className="font-editorial text-2xl font-semibold text-[#1C1310]">
                    Select & Custom Fit
                  </h3>
                  <p className="text-xs text-[#1C1310]/70 leading-relaxed">
                    Pick your favourite lehenga online or book a private fitting at our Indore
                    studio. Our master tailors adjust the waist and blouse to your exact size.
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-[#FAF8F5] border border-[#1C1310]/8 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-[#1C1310] text-white flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-[#E85D24]" />
                  </div>
                  <span className="text-[10px] font-mono-num uppercase tracking-widest text-[#1C1310]/50 font-semibold block">
                    Step 02
                  </span>
                  <h3 className="font-editorial text-2xl font-semibold text-[#1C1310]">
                    Slay The Function
                  </h3>
                  <p className="text-xs text-[#1C1310]/70 leading-relaxed">
                    Receive your steam-sanitized, crisp-pressed lehenga in a luxury garment bag.
                    Own the spotlight at Sangeet, Haldi, or Reception for 95% less than retail.
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-[#FAF8F5] border border-[#1C1310]/8 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-[#1C1310] text-white flex items-center justify-center">
                    <Clock className="w-4 h-4 text-[#E85D24]" />
                  </div>
                  <span className="text-[10px] font-mono-num uppercase tracking-widest text-[#1C1310]/50 font-semibold block">
                    Step 03
                  </span>
                  <h3 className="font-editorial text-2xl font-semibold text-[#1C1310]">
                    24-Hr Next-Day Return
                  </h3>
                  <p className="text-xs text-[#1C1310]/70 leading-relaxed">
                    Simply hand it back by 6:00 PM the day after your event. We handle all
                    professional dry-cleaning and zardosi care—zero stress for you.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* Minimalist Luxury Footer with Dynamic Bottom Logo */}
      <footer className="bg-[#1C1310] text-[#FAF8F5] py-14 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5 space-y-4">
            {siteSettings.bottomLogoUrl ? (
              <img
                src={siteSettings.bottomLogoUrl}
                alt={siteSettings.brandTitle || 'LOL By Sanjeevani'}
                className="h-20 w-auto object-contain bg-white/95 rounded-xl p-2"
              />
            ) : (
              <div className="inline-block bg-white/95 rounded-2xl px-4 py-2.5">
                <LolBrandLogo variant="navbar" />
              </div>
            )}
            <p className="text-xs text-[#FAF8F5]/70 max-w-sm leading-relaxed">
              {siteSettings.footerDescription}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#FAF8F5]/80 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#E85D24]" />
                {siteSettings.studioLocation}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E85D24]" />
                By Appointment & Instant Online Booking
              </span>
            </div>
          </div>

          <div className="md:col-span-4 space-y-2.5">
            <h4 className="text-[11px] uppercase tracking-[0.2em] text-[#E85D24] font-semibold">
              Curated Collections
            </h4>
            <ul className="space-y-2 text-xs text-[#FAF8F5]/75">
              {VIBE_FILTERS.map((item) => (
                <li key={item.value}>
                  <button
                    onClick={() => {
                      setActiveView('catalog');
                      setSelectedVibe(item.value);
                      document.getElementById('catalog-grid')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h4 className="text-[11px] uppercase tracking-[0.2em] text-[#E85D24] font-semibold">
              Book A Fitting
            </h4>
            <p className="text-xs text-[#FAF8F5]/70 leading-relaxed">
              Need help styling your Sangeet or Bridal look? Chat directly with Sanjeevani’s studio
              team on WhatsApp.
            </p>
            <a
              href={`https://wa.me/${siteSettings.whatsappNumber || '919826000000'}?text=Hi%20LOL%20By%20Sanjeevani!%20I%20would%20like%20to%20book%20a%20lehenga%20trial%20in%20Indore.`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#E85D24] text-white text-xs uppercase tracking-wider font-semibold hover:bg-[#d44d17] transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>WhatsApp Concierge</span>
            </a>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#FAF8F5]/50">
          <p>© {new Date().getFullYear()} LOL — Lehenga On Lease By Sanjeevani. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>24-Hour Next-Day Return • Steam-Sanitized Designer Wear • Indore</span>
            <button
              onClick={() => {
                setActiveView('admin');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1 text-[#FAF8F5]/40 hover:text-[#F5A623] transition-colors cursor-pointer"
              title="Open Backend CMS (/admin)"
            >
              <Lock className="w-3 h-3" />
              <span>Backend Admin</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Split-Screen Luxury Lookbook Modal */}
      <LookbookModal
        outfit={inspectOutfit}
        onClose={() => setInspectOutfit(null)}
        onRent={(o) => setRentalOutfit(o)}
        onShare={(o) => setShareOutfit(o)}
        isWishlisted={inspectOutfit ? wishlist.includes(inspectOutfit.id) : false}
        onToggleWishlist={handleToggleWishlist}
      />

      {/* Instant Reservation & Next-Day Return Modal */}
      <RentalModal
        outfit={rentalOutfit}
        onClose={() => setRentalOutfit(null)}
        onConfirmBooking={handleConfirmBooking}
        isTasksConnected={Boolean(googleAccessToken)}
      />

      {/* Social & WhatsApp Share Modal */}
      <ShareModal outfit={shareOutfit} onClose={() => setShareOutfit(null)} />

      {/* Studio Bookings & Google Tasks Drawer */}
      <GoogleTasksDrawer
        isOpen={isTasksDrawerOpen}
        onClose={() => setIsTasksDrawerOpen(false)}
        isConnected={Boolean(googleAccessToken)}
        isConnecting={isConnectingGoogle}
        isLoadingTasks={isLoadingGoogleTasks}
        onConnectGoogleTasks={handleConnectGoogleTasks}
        onRefreshTasks={handleRefreshGoogleTasks}
        tasks={localTasks}
        onToggleTaskStatus={handleToggleTaskStatus}
        onCreateSampleTask={handleCreateSampleTask}
        errorMsg={googleTasksError}
      />
    </div>
  );
}
export default App;
