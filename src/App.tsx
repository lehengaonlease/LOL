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
  Lock,
  HelpCircle,
  Instagram,
} from 'lucide-react';
import { INITIAL_OUTFITS } from './data/initialOutfits';
import { INITIAL_TESTIMONIALS } from './data/initialTestimonials';
import {
  LehengaOutfit,
  VibeCategory,
  RentalBookingDraft,
  StudioTaskReminder,
  SiteSettings,
  DEFAULT_SITE_SETTINGS,
  CustomerTestimonial,
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
import { TestimonialSection } from './components/TestimonialSection';
import { FaqModal } from './components/FaqModal';
import { resolvePublicVideoPath } from './components/VideoPlayer';
import {
  requestGoogleTasksToken,
  getStoredAccessToken,
  ensureLolTaskList,
  listTasks,
  createTask,
  toggleTaskStatus,
} from './services/googleTasksService';

const STORAGE_KEY_OUTFITS = 'lol_indore_outfits_v4';
const STORAGE_KEY_TASKS = 'lol_indore_tasks_v2';
const STORAGE_KEY_WISHLIST = 'lol_indore_wishlist_v2';
const STORAGE_KEY_SITE_SETTINGS = 'lol_indore_site_settings_v4';
const STORAGE_KEY_TESTIMONIALS = 'lol_indore_testimonials_v2';
const CATALOG_SYNC_CHANNEL = 'lol_indore_catalog_sync_v1';

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

function findOutfitFromLocation(outfitsList: LehengaOutfit[]): LehengaOutfit | null {
  const params = new URLSearchParams(window.location.search);
  const queryOutfit = params.get('outfit');
  const rawPath = decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, '');

  let candidateSlug = '';
  if (queryOutfit) {
    candidateSlug = queryOutfit.trim().toLowerCase();
  } else if (rawPath.toLowerCase().startsWith('outfit/')) {
    candidateSlug = rawPath.slice('outfit/'.length).trim().toLowerCase();
  } else if (rawPath.toLowerCase().startsWith('lehenga/')) {
    candidateSlug = rawPath.slice('lehenga/'.length).trim().toLowerCase();
  } else if (rawPath.toLowerCase().startsWith('share/')) {
    candidateSlug = rawPath.slice('share/'.length).trim().toLowerCase();
  } else if (rawPath && rawPath.toLowerCase() !== 'admin') {
    candidateSlug = rawPath.trim().toLowerCase();
  }

  if (!candidateSlug) return null;

  return (
    outfitsList.find(
      (o) =>
        o.id.toLowerCase() === candidateSlug ||
        o.code.toLowerCase() === candidateSlug
    ) || null
  );
}

export function App() {
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SITE_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed.footerDescription &&
          parsed.footerDescription.includes('High-energy Garbas, royal sangeets')
        ) {
          parsed.footerDescription = DEFAULT_SITE_SETTINGS.footerDescription;
        }
        return { ...DEFAULT_SITE_SETTINGS, ...parsed };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SITE_SETTINGS;
  });

  const [outfits, setOutfits] = useState<LehengaOutfit[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_OUTFITS);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
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

  const [testimonials, setTestimonials] = useState<CustomerTestimonial[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TESTIMONIALS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_TESTIMONIALS;
  });

  const [activeView, setActiveViewState] = useState<'catalog' | 'admin'>(detectInitialView);
  const [selectedVibe, setSelectedVibe] = useState<VibeCategory>('All Vibes');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');
  const [showWishlistOnly, setShowWishlistOnly] = useState(false);

  const broadcastCatalogUpdate = (updatedOutfits: LehengaOutfit[]) => {
    try {
      localStorage.setItem(STORAGE_KEY_OUTFITS, JSON.stringify(updatedOutfits));
    } catch {
      // ignore
    }
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel(CATALOG_SYNC_CHANNEL);
        channel.postMessage({ type: 'CATALOG_UPDATED', outfits: updatedOutfits });
        channel.close();
      }
    } catch {
      // ignore
    }
  };

  // Sync URL path (/ vs /admin) with activeView
  const setActiveView = (view: 'catalog' | 'admin') => {
    setActiveViewState(view);
    setInspectOutfit(null);
    try {
      const nextUrl = view === 'admin' ? '/admin' : '/';
      if (window.location.pathname !== nextUrl) {
        window.history.pushState({}, '', nextUrl);
      }
    } catch {
      // ignore in restricted iframe history environments
    }
  };

  const handleOpenOutfitPage = (outfit: LehengaOutfit) => {
    setActiveViewState('catalog');
    setInspectOutfit(outfit);
    try {
      const nextUrl = `/outfit/${encodeURIComponent(outfit.id)}`;
      if (window.location.pathname !== nextUrl) {
        window.history.pushState({}, '', nextUrl);
      }
    } catch {
      // ignore in restricted iframe history environments
    }
  };

  const handleCloseOutfitPage = () => {
    setInspectOutfit(null);
    try {
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
      }
    } catch {
      // ignore in restricted iframe history environments
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveViewState(detectInitialView());
      setInspectOutfit(findOutfitFromLocation(outfits));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [outfits]);

  // Real-time (<1s) sync of outfits, site settings, and testimonials across tabs and server
  useEffect(() => {
    const initialDefaultJson = JSON.stringify(INITIAL_OUTFITS);

    const fetchLatestOutfits = () => {
      fetch('/api/outfits')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (Array.isArray(data)) {
            setOutfits((prev) => {
              const prevJson = JSON.stringify(prev);
              const nextJson = JSON.stringify(data);
              // If the server just cold-started with default INITIAL_OUTFITS while localStorage has user-customized outfits, restore localStorage to server
              if (nextJson === initialDefaultJson && prevJson !== initialDefaultJson) {
                fetch('/api/outfits/sync', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ outfits: prev }),
                }).catch(() => {});
                return prev;
              }
              if (prevJson !== nextJson) {
                try {
                  localStorage.setItem(STORAGE_KEY_OUTFITS, nextJson);
                } catch {}
                return data;
              }
              return prev;
            });
          }
        })
        .catch(() => {});
    };

    fetchLatestOutfits();

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

    fetch('/api/testimonials')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data)) {
          setTestimonials(data);
          localStorage.setItem(STORAGE_KEY_TESTIMONIALS, JSON.stringify(data));
        }
      })
      .catch(() => {});

    // Listen to BroadcastChannel for instant (<50ms) cross-tab updates
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(CATALOG_SYNC_CHANNEL);
        channel.onmessage = (event) => {
          if (event.data?.type === 'CATALOG_UPDATED' && Array.isArray(event.data.outfits)) {
            setOutfits(event.data.outfits);
          }
        };
      }
    } catch {
      // ignore
    }

    // Listen to localStorage changes across tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_OUTFITS && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setOutfits(parsed);
          }
        } catch {
          // ignore
        }
      }
      if (e.key === STORAGE_KEY_SITE_SETTINGS && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            setSiteSettings({ ...DEFAULT_SITE_SETTINGS, ...parsed });
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    // Poll backend every 900ms so any published outfit is visible within 1 second
    const pollInterval = window.setInterval(fetchLatestOutfits, 900);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.clearInterval(pollInterval);
      if (channel) channel.close();
    };
  }, []);

  const handleDeleteTestimonial = async (id: string) => {
    const updated = testimonials.filter((item) => item.id !== id);
    setTestimonials(updated);
    try {
      localStorage.setItem(STORAGE_KEY_TESTIMONIALS, JSON.stringify(updated));
    } catch {
      // ignore
    }
    try {
      await fetch(`/api/testimonials/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch {
      // fallback to localStorage
    }
  };

  const handleAddTestimonial = async (newTestimonial: CustomerTestimonial) => {
    const updated = [newTestimonial, ...testimonials];
    setTestimonials(updated);
    try {
      localStorage.setItem(STORAGE_KEY_TESTIMONIALS, JSON.stringify(updated));
    } catch {
      // ignore
    }
    try {
      const res = await fetch('/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTestimonial),
      });
      if (res.ok) {
        const saved = await res.json();
        setTestimonials((prev) =>
          prev.map((item) => (item.id === newTestimonial.id ? saved : item))
        );
      }
    } catch {
      // fallback to localStorage
    }
  };

  // Modals & Full-Page Outfit Route
  const [inspectOutfit, setInspectOutfit] = useState<LehengaOutfit | null>(() =>
    findOutfitFromLocation(outfits)
  );
  const [rentalOutfit, setRentalOutfit] = useState<LehengaOutfit | null>(null);
  const [shareOutfit, setShareOutfit] = useState<LehengaOutfit | null>(null);
  const [isTasksDrawerOpen, setIsTasksDrawerOpen] = useState(false);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);

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

  // Deep link support (/outfit/lol-ind-01, /lol-ind-01, or ?outfit=LOL-IND-01)
  useEffect(() => {
    const found = findOutfitFromLocation(outfits);
    if (found) {
      setInspectOutfit(found);
    }
  }, [outfits]);

  const handleUpdateSiteSettings = async (nextSettings: SiteSettings) => {
    setSiteSettings(nextSettings);
    try {
      localStorage.setItem(STORAGE_KEY_SITE_SETTINGS, JSON.stringify(nextSettings));
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel(CATALOG_SYNC_CHANNEL);
        channel.postMessage({ type: 'SETTINGS_UPDATED', settings: nextSettings });
        channel.close();
      }
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
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel(CATALOG_SYNC_CHANNEL);
          channel.postMessage({ type: 'SETTINGS_UPDATED', settings: saved });
          channel.close();
        }
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

  const dynamicVibeFilters = useMemo(() => {
    const primaryLabel = siteSettings.curatedCollectionTitle || 'Navratri Ni Pehvesh';
    return [{ label: primaryLabel, value: 'All Vibes' }];
  }, [siteSettings.curatedCollectionTitle]);

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
        if (sortBy === 'price-desc') return b.pricePerDay - a.pricePerDay;
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
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#FFF5F8] via-white to-[#FFF0F5] text-[#4A1525]">
      {/* Sticky Minimalist Luxury Header */}
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        isOutfitPage={Boolean(inspectOutfit)}
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
            onAddOutfit={async (newOutfit) => {
              setSelectedVibe('All Vibes');
              setSearchQuery('');
              setShowWishlistOnly(false);
              setOutfits((prev) => {
                const updated = [newOutfit, ...prev];
                broadcastCatalogUpdate(updated);
                return updated;
              });
              try {
                const res = await fetch('/api/outfits', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-admin-password': 'sanjeevani',
                  },
                  body: JSON.stringify(newOutfit),
                });
                if (res.ok) {
                  const saved = await res.json();
                  setOutfits((prev) => {
                    const synced = prev.map((o) => (o.id === newOutfit.id ? saved : o));
                    broadcastCatalogUpdate(synced);
                    return synced;
                  });
                }
              } catch {
                // fallback to local state
              }
            }}
            onUpdateOutfit={async (updatedOutfit) => {
              setOutfits((prev) => {
                const updated = prev.map((o) =>
                  o.id === updatedOutfit.id ? updatedOutfit : o
                );
                broadcastCatalogUpdate(updated);
                return updated;
              });
              try {
                const res = await fetch(`/api/outfits/${encodeURIComponent(updatedOutfit.id)}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-admin-password': 'sanjeevani',
                  },
                  body: JSON.stringify(updatedOutfit),
                });
                if (res.ok) {
                  const saved = await res.json();
                  setOutfits((prev) => {
                    const synced = prev.map((o) => (o.id === updatedOutfit.id ? saved : o));
                    broadcastCatalogUpdate(synced);
                    return synced;
                  });
                }
              } catch {
                // fallback to local state
              }
            }}
            onDeleteOutfit={async (id) => {
              setOutfits((prev) => {
                const updated = prev.filter((o) => o.id !== id);
                broadcastCatalogUpdate(updated);
                return updated;
              });
              try {
                await fetch(`/api/outfits/${encodeURIComponent(id)}`, {
                  method: 'DELETE',
                  headers: {
                    'x-admin-password': 'sanjeevani',
                  },
                });
              } catch {
                // fallback to local state
              }
            }}
            onResetCatalog={() => {}}
            onBackToCatalog={() => setActiveView('catalog')}
          />
        </main>
      ) : inspectOutfit ? (
        <main className="flex-1">
          <LookbookModal
            outfit={inspectOutfit}
            allOutfits={outfits}
            wishlist={wishlist}
            onClose={handleCloseOutfitPage}
            onSelectOutfit={handleOpenOutfitPage}
            onRent={(o) => setRentalOutfit(o)}
            onShare={(o) => setShareOutfit(o)}
            isWishlisted={wishlist.includes(inspectOutfit.id)}
            onToggleWishlist={handleToggleWishlist}
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
            onInspectClick={handleOpenOutfitPage}
            onSelectVibe={(vibe) => setSelectedVibe(vibe)}
          />

          {/* Main Couture Collection Section */}
          <section
            id="catalog-grid"
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20"
          >
            {/* Section Title & Subtitle */}
            <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
              <span className="text-[11px] uppercase tracking-[0.22em] text-[#D81B60] font-semibold block">
                {siteSettings.catalogSectionKicker || DEFAULT_SITE_SETTINGS.catalogSectionKicker}
              </span>
              <h2 className="font-editorial text-3xl sm:text-5xl font-semibold text-[#4A1525] tracking-tight">
                {siteSettings.catalogSectionTitle || DEFAULT_SITE_SETTINGS.catalogSectionTitle}
              </h2>
              <p className="text-xs sm:text-sm text-[#4A1525]/70">
                {siteSettings.catalogSectionSubtitle || DEFAULT_SITE_SETTINGS.catalogSectionSubtitle}
              </p>
            </div>

            {/* Clean Filter & Sort Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 mb-8 border-b border-[#F8BBD0]/60">
              {/* Occasion Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                {dynamicVibeFilters.map((tab) => {
                  const active = selectedVibe === tab.value && !showWishlistOnly;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => {
                        setShowWishlistOnly(false);
                        setSelectedVibe(tab.value);
                      }}
                      className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        active
                          ? 'bg-[#D81B60] text-white shadow-xs'
                          : 'bg-white text-[#4A1525]/75 hover:text-[#D81B60] border border-[#F8BBD0]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}

                {wishlist.length > 0 && (
                  <button
                    onClick={() => setShowWishlistOnly(!showWishlistOnly)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                      showWishlistOnly
                        ? 'bg-[#D81B60] text-white'
                        : 'bg-white text-[#D81B60] border border-[#F48FB1]'
                    }`}
                  >
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    <span>Saved ({wishlist.length})</span>
                  </button>
                )}
              </div>

              {/* Right Sort Control */}
              <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                <span className="text-xs text-[#4A1525]/65">
                  Showing <strong className="text-[#4A1525]">{filteredOutfits.length}</strong> designs
                </span>

                <div className="relative inline-flex items-center">
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#D81B60] absolute left-3 pointer-events-none" />
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as 'featured' | 'price-asc' | 'price-desc')
                    }
                    className="pl-8 pr-4 py-2 rounded-full bg-white border border-[#F8BBD0] text-xs font-medium text-[#4A1525] focus:outline-none focus:border-[#D81B60] cursor-pointer"
                  >
                    <option value="featured">Sort: Featured</option>
                    <option value="price-asc">Rent: Low to High</option>
                    <option value="price-desc">Rent: High to Low</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Product Grid (3 Columns on Desktop — Full 3:4 Portrait Cards) */}
            {filteredOutfits.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-[#F8BBD0]/60 p-8">
                <Sparkles className="w-8 h-8 text-[#D81B60] mx-auto mb-3" />
                <h3 className="font-editorial text-2xl font-semibold text-[#4A1525]">
                  No matching lehengas found
                </h3>
                <p className="text-xs text-[#4A1525]/60 mt-1 mb-5">
                  Try clearing your search filter or exploring all occasion edits.
                </p>
                <button
                  onClick={() => {
                    setSelectedVibe('All Vibes');
                    setSearchQuery('');
                    setShowWishlistOnly(false);
                  }}
                  className="px-6 py-2.5 rounded-full bg-[#D81B60] text-white text-xs uppercase tracking-wider font-semibold hover:bg-[#AD1457] transition-colors cursor-pointer"
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
                    onInspect={handleOpenOutfitPage}
                    isWishlisted={wishlist.includes(outfit.id)}
                    onToggleWishlist={handleToggleWishlist}
                  />
                ))}
              </div>
            )}
          </section>

          {/* How Our 24-Hour Couture Lease Works */}
          <section className="bg-[#FFF0F5] border-y border-[#F8BBD0]/60 py-16 sm:py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-xl mx-auto mb-12">
                <span className="text-[11px] uppercase tracking-[0.22em] text-[#D81B60] font-semibold block">
                  RENT, FLEX, RETURN
                </span>
                <h2 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#4A1525] mt-1">
                  How to secure the drip in 3 steps
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="p-6 rounded-2xl bg-white border border-[#F8BBD0]/60 shadow-2xs space-y-3">
                  <div className="w-10 h-10 rounded-full bg-[#FFF0F5] border border-[#F8BBD0] flex items-center justify-center">
                    <Ruler className="w-4 h-4 text-[#D81B60]" />
                  </div>
                  <span className="text-[10px] font-mono-num uppercase tracking-widest text-[#D81B60] font-semibold block">
                    Step 01
                  </span>
                  <h3 className="font-editorial text-2xl font-semibold text-[#4A1525]">
                    Lock Your Look & Tailor It
                  </h3>
                  <p className="text-xs text-[#4A1525]/75 leading-relaxed">
                    Pick your dream fit online or slide into our Indore studio. Our master tailors
                    will alter the waist and blouse so it hugs you perfectly. No loose-fit disasters
                    here, bestie.
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-white border border-[#F8BBD0]/60 shadow-2xs space-y-3">
                  <div className="w-10 h-10 rounded-full bg-[#FFF0F5] border border-[#F8BBD0] flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-[#D81B60]" />
                  </div>
                  <span className="text-[10px] font-mono-num uppercase tracking-widest text-[#D81B60] font-semibold block">
                    Step 02
                  </span>
                  <h3 className="font-editorial text-2xl font-semibold text-[#4A1525]">
                    Slay The Function
                  </h3>
                  <p className="text-xs text-[#4A1525]/75 leading-relaxed">
                    Pick up your freshly steam-sanitized, perfectly pressed outfit in a luxury bag.
                    Step into the venue, break the internet, and drop jaws for 95% less than retail
                    price.
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-white border border-[#F8BBD0]/60 shadow-2xs space-y-3">
                  <div className="w-10 h-10 rounded-full bg-[#FFF0F5] border border-[#F8BBD0] flex items-center justify-center">
                    <Clock className="w-4 h-4 text-[#D81B60]" />
                  </div>
                  <span className="text-[10px] font-mono-num uppercase tracking-widest text-[#D81B60] font-semibold block">
                    Step 03
                  </span>
                  <h3 className="font-editorial text-2xl font-semibold text-[#4A1525]">
                    Return on time
                  </h3>
                  <p className="text-xs text-[#4A1525]/75 leading-relaxed">
                    Bring it back by 12:00 PM the next day so another Indori kudi can slay her
                    weekend. We handle all the heavy dry-cleaning and zardosi care—zero stress for
                    you!
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Indore Customer Testimonial Slider & Photo Review Submission */}
          <TestimonialSection
            testimonials={testimonials}
            onAddTestimonial={handleAddTestimonial}
            onDeleteTestimonial={handleDeleteTestimonial}
          />
        </main>
      )}

      {/* Light Pink & White Luxury Footer with Dynamic Bottom Logo */}
      <footer className="bg-[#FCE4EC] text-[#4A1525] py-14 border-t border-[#F8BBD0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3.5">
              {siteSettings.bottomLogoUrl ? (
                <img
                  src={resolvePublicVideoPath(siteSettings.bottomLogoUrl)}
                  alt={siteSettings.brandTitle || 'LOL By Sanjeevani'}
                  style={{ height: `${siteSettings.bottomLogoHeight || 88}px` }}
                  className="w-auto object-contain bg-white rounded-xl p-2 border border-[#F8BBD0] transition-all duration-200"
                />
              ) : (
                <div
                  className="inline-block bg-white rounded-2xl px-4 py-2.5 border border-[#F8BBD0] origin-left transition-transform duration-200"
                  style={{
                    transform: `scale(${(siteSettings.bottomLogoHeight || 88) / 80})`,
                  }}
                >
                  <LolBrandLogo variant="navbar" />
                </div>
              )}

              {/* Store Map Box matching the bottom LOL logo box design */}
              <div
                style={{
                  height: `${siteSettings.bottomLogoHeight || 88}px`,
                  width: `${siteSettings.bottomLogoHeight || 88}px`,
                }}
                className="bg-white rounded-xl p-2 border border-[#F8BBD0] overflow-hidden shrink-0 transition-all duration-200"
              >
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3682.2433627829428!2d75.8253262753026!3d22.64471327944041!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3962fbf37cbf4d3f%3A0xd1a33d5920c15580!2sAnantnath%20Apartment!5e0!3m2!1sen!2sin!4v1790532421053!5m2!1sen!2sin"
                  title="Store Location - Anantnath Apartment"
                  className="w-full h-full rounded-lg border-0"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            </div>
            <p className="text-xs text-[#4A1525]/75 max-w-sm leading-relaxed">
              {siteSettings.footerDescription ||
                'At LOL By Sanjeevani, we are entirely obsessed with making you look like a million bucks on and off the feed. Our collection is meticulously handpicked to deliver pure main-character energy for every grand wedding, sangeet night, and high-energy festival in Indore. We refresh our racks constantly, ensuring you always stay three steps ahead of the trends.'}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#4A1525]/85 pt-1">
              <a
                href="https://www.instagram.com/lehenga_on_lease/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow LOL Lehenga On Lease on Instagram"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-[#D81B60] text-[#4A1525] hover:text-white border border-[#F8BBD0] hover:border-[#D81B60] font-semibold transition-all shadow-2xs group"
              >
                <Instagram className="w-4 h-4 text-[#D81B60] group-hover:text-white transition-colors shrink-0" />
                <span>@lehenga_on_lease</span>
              </a>
            </div>
          </div>

          <div className="md:col-span-4 space-y-2.5">
            <h4 className="text-[11px] uppercase tracking-[0.2em] text-[#D81B60] font-semibold">
              Curated Collections
            </h4>
            <ul className="space-y-2 text-xs text-[#4A1525]/80">
              <li>
                <button
                  onClick={() => {
                    setActiveView('catalog');
                    setSelectedVibe('All Vibes');
                    document.getElementById('catalog-grid')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="hover:text-[#D81B60] transition-colors cursor-pointer"
                >
                  {siteSettings.curatedCollectionTitle || 'Navratri Ni Pehvesh'}
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3 space-y-3">
            <div className="flex flex-col items-start gap-2.5">
              <a
                href={`https://wa.me/${siteSettings.whatsappNumber || '919826000000'}?text=Hi%20LOL%20By%20Sanjeevani!%20I%20would%20like%20to%20book%20a%20lehenga%20trial%20in%20Indore.`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-48 px-5 py-3 rounded-xl bg-[#D81B60] text-white text-xs uppercase tracking-wider font-semibold hover:bg-[#AD1457] transition-all shadow-sm"
              >
                <PhoneCall className="w-3.5 h-3.5 shrink-0" />
                <span>WhatsApp Us</span>
              </a>

              <button
                type="button"
                onClick={() => setIsFaqModalOpen(true)}
                title="LOL FAQ: The Ultimate Vibe Check"
                className="inline-flex items-center justify-center gap-2 w-48 px-5 py-3 rounded-xl bg-white hover:bg-[#D81B60] text-[#4A1525] hover:text-white border border-[#F48FB1] hover:border-[#D81B60] text-xs uppercase tracking-wider font-semibold transition-all shadow-sm cursor-pointer group"
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#D81B60] group-hover:text-white transition-colors shrink-0" />
                <span>FAQ</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pt-6 border-t border-[#F8BBD0] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#4A1525]/65">
          <p>© {new Date().getFullYear()} LOL — Lehenga On Lease By Sanjeevani. All rights reserved.</p>
          <a
            href="http://sanjgroup.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 text-[#4A1525]/80 hover:text-[#D81B60] font-medium transition-colors group"
          >
            <span className="underline-offset-4 group-hover:underline">
              A Part of Sanj Group, Indore
            </span>
            <span className="inline-flex items-center justify-center bg-white rounded-lg px-2 py-1 border border-[#F8BBD0] shadow-2xs group-hover:border-[#D81B60] transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 420 260"
                fill="none"
                className="h-6 w-auto"
                role="img"
                aria-label="Sanj Group of Properties Logo"
              >
                <g fill="#D62429">
                  <path d="M303 82c-9 2-15 11-13 21 2 9 8 17 11 26 2 7 3 15 8 19 5 4 13 2 15-4 2-6-1-13-2-19-1-8 4-16 3-25-1-11-11-20-22-18z" />
                  <ellipse cx="322" cy="69" rx="6" ry="8" transform="rotate(-10 322 69)" />
                  <ellipse cx="310" cy="68" rx="4.2" ry="5.8" transform="rotate(-15 310 68)" />
                  <ellipse cx="301" cy="72" rx="3.6" ry="5" transform="rotate(-20 301 72)" />
                  <ellipse cx="294" cy="78" rx="3" ry="4.2" transform="rotate(-25 294 78)" />
                  <ellipse cx="289" cy="85" rx="2.5" ry="3.5" transform="rotate(-30 289 85)" />
                  <path d="M356 101c9 2 15 11 13 21-2 9-8 17-11 26-2 7-3 15-8 19-5 4-13 2-15-4-2-6 1-13 2-19 1-8-4-16-3-25 1-11 11-20 22-18z" />
                  <ellipse cx="338" cy="89" rx="6" ry="8" transform="rotate(10 338 89)" />
                  <ellipse cx="350" cy="88" rx="4.2" ry="5.8" transform="rotate(15 350 88)" />
                  <ellipse cx="359" cy="92" rx="3.6" ry="5" transform="rotate(20 359 92)" />
                  <ellipse cx="366" cy="98" rx="3" ry="4.2" transform="rotate(25 366 98)" />
                  <ellipse cx="371" cy="105" rx="2.5" ry="3.5" transform="rotate(30 371 105)" />
                </g>
                <path
                  d="M204 97c17 1 28-10 26-22-2-14-21-24-48-24-39 0-76 21-76 47 0 23 26 30 56 36 27 5 46 14 43 35-4 27-40 46-88 46-38 0-69-14-75-38-4-16 2-32 11-32 8 0 12 14 16 31 5 20 17 39 39 47"
                  stroke="#0A0A0A"
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M251 141c-16 2-36 18-39 33-2 9 4 13 12 9 11-6 23-22 30-37l-8 34c-2 8 3 11 9 6 10-8 24-25 32-38l-16 47c4-14 21-38 34-39 8-1 10 6 8 15-3 12-1 19 6 19 9 0 21-12 31-26l-37 101c-6 17-14 25-18 22-4-3-1-15 6-27 14-24 46-52 84-78"
                  stroke="#0A0A0A"
                  strokeWidth="9.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <text
                  x="38"
                  y="228"
                  fill="#0A0A0A"
                  fontFamily="Georgia, 'Times New Roman', serif"
                  fontSize="31"
                  letterSpacing="0.2"
                >
                  Group of properties.
                </text>
              </svg>
            </span>
          </a>
        </div>
      </footer>

      {/* Instant Reservation & Next-Day Return Modal */}
      <RentalModal
        outfit={rentalOutfit}
        onClose={() => setRentalOutfit(null)}
        onConfirmBooking={handleConfirmBooking}
        isTasksConnected={Boolean(googleAccessToken)}
      />

      {/* Social & WhatsApp Share Modal */}
      <ShareModal outfit={shareOutfit} onClose={() => setShareOutfit(null)} />

      {/* FAQ Modal triggered from Bottom Footer */}
      <FaqModal isOpen={isFaqModalOpen} onClose={() => setIsFaqModalOpen(false)} />

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
