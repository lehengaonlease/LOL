import React, { useState, useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
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
  SlidersHorizontal,
  Palette,
  CheckCircle2,
  Calendar,
  X,
} from 'lucide-react';
import { INITIAL_OUTFITS, BUNDLED_CATALOG_UPDATED_AT } from './data/initialOutfits';
import { INITIAL_TESTIMONIALS } from './data/initialTestimonials';
import {
  LehengaOutfit,
  VibeCategory,
  RentalBookingDraft,
  RentalBooking,
  StudioTaskReminder,
  SiteSettings,
  DEFAULT_SITE_SETTINGS,
  CustomerTestimonial,
  normalizeStudioWhatsAppDisplay,
  formatWhatsAppUrlNumber,
  LEHENGA_COLOR_OPTIONS,
  resolveOutfitColor,
  getOutfitColorSwatch,
  isOutfitBookedOnDate,
  formatShortDate,
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
import { OptimizedImage } from './components/OptimizedImage';
import { DateSelectionPopup } from './components/DateSelectionPopup';
import {
  subscribeToLiveStore,
  saveOutfitToCloud,
  deleteOutfitFromCloud,
  saveSiteSettingsToCloud,
  saveTestimonialsToCloud,
  saveBookingToCloud,
} from './services/firebaseSyncService';
import {
  requestGoogleTasksToken,
  getStoredAccessToken,
  ensureLolTaskList,
  listTasks,
  createTask,
  toggleTaskStatus,
} from './services/googleTasksService';

const STORAGE_KEY_OUTFITS = 'lol_indore_outfits_v6';
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
        parsed.whatsappNumber = normalizeStudioWhatsAppDisplay(parsed.whatsappNumber);
        return { ...DEFAULT_SITE_SETTINGS, ...parsed };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SITE_SETTINGS;
  });

  const [outfits, setOutfits] = useState<LehengaOutfit[]>(() => {
    try {
      const localTs = Number(localStorage.getItem('lol_local_catalog_updated_at_v1') || '0');
      const saved = localStorage.getItem(STORAGE_KEY_OUTFITS);
      if (saved !== null && localTs >= BUNDLED_CATALOG_UPDATED_AT) {
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
  const [sortBy, setSortBy] = useState<
    'featured' | 'price-asc' | 'price-desc' | 'under-2000' | '2000-3500' | 'above-3500'
  >('featured');
  const [selectedColor, setSelectedColor] = useState<string>('All Colours');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'booked'>('all');
  const [selectedEventDate, setSelectedEventDate] = useState<string>('');
  const [bookings, setBookings] = useState<RentalBooking[]>(() => {
    try {
      const saved = localStorage.getItem('lol_indore_bookings_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [showWishlistOnly, setShowWishlistOnly] = useState(false);
  const [isDatePopupOpen, setIsDatePopupOpen] = useState(false);
  const catalogGridRef = useRef<HTMLDivElement | null>(null);

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

  const todayStr = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // Auto Date selection popup: reliably triggers within 5 seconds on catalog when no date is selected
  const hasAutoPoppedRef = useRef(false);

  useEffect(() => {
    // Clear any previous blocking session storage so it works reliably
    try {
      sessionStorage.removeItem('lol_date_popup_shown_v2');
      sessionStorage.removeItem('lol_date_popup_shown');
    } catch {
      // ignore
    }

    if (activeView === 'admin' || inspectOutfit || selectedEventDate || hasAutoPoppedRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      if (!selectedEventDate && activeView === 'catalog' && !inspectOutfit) {
        setIsDatePopupOpen(true);
        hasAutoPoppedRef.current = true;
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [activeView, inspectOutfit, selectedEventDate]);

  const handlePopupDateSelect = (chosenDate: string) => {
    setSelectedEventDate(chosenDate);
    setIsDatePopupOpen(false);
    hasAutoPoppedRef.current = true;
    const gridEl = document.getElementById('catalog-grid');
    if (gridEl) {
      gridEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

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
    if (outfit.available === false) return;
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

  // Real-time (<1s) cloud sync via Firebase Firestore + cross-tab BroadcastChannel
  useEffect(() => {
    const unsubscribeFirestore = subscribeToLiveStore({
      initialOutfits: outfits,
      initialSettings: siteSettings,
      initialTestimonials: testimonials,
      initialBookings: bookings,
      onOutfitsChange: (liveOutfits) => {
        setOutfits(liveOutfits);
        setInspectOutfit((prevInspect) => {
          if (!prevInspect) return null;
          return liveOutfits.find((o) => o.id === prevInspect.id) || prevInspect;
        });
        try {
          localStorage.setItem(STORAGE_KEY_OUTFITS, JSON.stringify(liveOutfits));
        } catch {
          // ignore
        }
      },
      onSettingsChange: (liveSettings) => {
        const merged = {
          ...DEFAULT_SITE_SETTINGS,
          ...liveSettings,
          whatsappNumber: normalizeStudioWhatsAppDisplay(liveSettings.whatsappNumber),
        };
        setSiteSettings(merged);
        try {
          localStorage.setItem(STORAGE_KEY_SITE_SETTINGS, JSON.stringify(merged));
        } catch {
          // ignore
        }
      },
      onTestimonialsChange: (liveTestimonials) => {
        setTestimonials(liveTestimonials);
        try {
          localStorage.setItem(STORAGE_KEY_TESTIMONIALS, JSON.stringify(liveTestimonials));
        } catch {
          // ignore
        }
      },
      onBookingsChange: (liveBookings) => {
        setBookings(liveBookings);
        try {
          localStorage.setItem('lol_indore_bookings_v2', JSON.stringify(liveBookings));
        } catch {
          // ignore
        }
      },
    });

    // Listen to BroadcastChannel for instant (<50ms) same-browser cross-tab updates
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(CATALOG_SYNC_CHANNEL);
        channel.onmessage = (event) => {
          if (event.data?.type === 'CATALOG_UPDATED' && Array.isArray(event.data.outfits)) {
            setOutfits(event.data.outfits);
          }
          if (event.data?.type === 'SETTINGS_UPDATED' && event.data.settings) {
            setSiteSettings({ ...DEFAULT_SITE_SETTINGS, ...event.data.settings });
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

    return () => {
      unsubscribeFirestore();
      window.removeEventListener('storage', handleStorage);
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
      await saveTestimonialsToCloud(updated);
    } catch (err) {
      console.error('Failed to sync deleted testimonial to cloud:', err);
    }
  };

  const handleReplyTestimonial = async (id: string, replyText: string) => {
    const updated = testimonials.map((item) =>
      item.id === id
        ? {
            ...item,
            adminReply: replyText || undefined,
            adminRepliedAt: replyText ? new Date().toISOString() : undefined,
          }
        : item
    );
    setTestimonials(updated);
    try {
      localStorage.setItem(STORAGE_KEY_TESTIMONIALS, JSON.stringify(updated));
    } catch {
      // ignore
    }
    try {
      await saveTestimonialsToCloud(updated);
    } catch (err) {
      console.error('Failed to sync testimonial reply to cloud:', err);
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
      await saveTestimonialsToCloud(updated);
    } catch (err) {
      console.error('Failed to sync new testimonial to cloud:', err);
    }
  };

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
      await saveSiteSettingsToCloud(nextSettings);
    } catch (err) {
      console.error('Failed to sync site settings to cloud:', err);
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

  const availableForDateCount = useMemo(() => {
    if (!selectedEventDate) {
      return outfits.filter((o) => o.available !== false).length;
    }
    return outfits.filter(
      (o) => o.available !== false && !isOutfitBookedOnDate(o, selectedEventDate, bookings)
    ).length;
  }, [outfits, selectedEventDate, bookings]);

  const filteredOutfits = useMemo(() => {
    return outfits
      .filter((item) => {
        if (showWishlistOnly && !wishlist.includes(item.id)) return false;
        if (selectedVibe !== 'All Vibes' && item.vibeCategory !== selectedVibe) {
          return false;
        }

        const isBooked =
          item.available === false ||
          (Boolean(selectedEventDate) && isOutfitBookedOnDate(item, selectedEventDate, bookings));
        const isAvail = !isBooked;

        if (availabilityFilter === 'available' && !isAvail) return false;
        if (availabilityFilter === 'booked' && isAvail) return false;

        if (sortBy === 'under-2000' && item.pricePerDay >= 2000) return false;
        if (sortBy === '2000-3500' && (item.pricePerDay < 2000 || item.pricePerDay > 3500)) {
          return false;
        }
        if (sortBy === 'above-3500' && item.pricePerDay <= 3500) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchDesc = item.description.toLowerCase().includes(q);
          const matchVibe = item.vibeCategory.toLowerCase().includes(q);
          return matchTitle || matchDesc || matchVibe;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc' || sortBy === 'under-2000' || sortBy === '2000-3500') {
          return a.pricePerDay - b.pricePerDay;
        }
        if (sortBy === 'price-desc' || sortBy === 'above-3500') {
          return b.pricePerDay - a.pricePerDay;
        }
        return 0;
      });
  }, [
    outfits,
    selectedVibe,
    selectedColor,
    availabilityFilter,
    selectedEventDate,
    bookings,
    searchQuery,
    sortBy,
    showWishlistOnly,
    wishlist,
  ]);

  useEffect(() => {
    if (activeView !== 'catalog' || inspectOutfit || !catalogGridRef.current) return;

    const items = catalogGridRef.current.querySelectorAll('.image');
    if (!items.length) return;

    gsap.set(items, { autoAlpha: 0 });

    const batchTriggers = ScrollTrigger.batch(items, {
      onEnter: (batch) =>
        gsap.to(batch, {
          autoAlpha: 1,
          stagger: 0.2,
          duration: 1,
          ease: 'sine.out',
          overwrite: true,
        }),
    });

    ScrollTrigger.refresh();

    return () => {
      batchTriggers.forEach((trigger) => trigger.kill());
    };
  }, [filteredOutfits, activeView, inspectOutfit]);

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
    const newBookingRecord: RentalBooking = {
      id: `bk-${Date.now()}`,
      outfitId: booking.outfit.id,
      outfitCode: booking.outfit.code,
      outfitTitle: booking.outfit.title,
      pricePerDay: booking.outfit.pricePerDay,
      rentalDate: booking.eventDate,
      returnDate: booking.returnDate,
      pickupTime: '01:00 PM - Afternoon Slay',
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      promisedNextDayReturn: booking.agreedToNextDayReturn,
      createdAt: new Date().toISOString(),
      syncedToGoogleTasks: Boolean(syncToGoogleTasks),
    };

    const nextBookings = [newBookingRecord, ...bookings];
    setBookings(nextBookings);
    try {
      localStorage.setItem('lol_indore_bookings_v2', JSON.stringify(nextBookings));
    } catch {
      // ignore
    }

    try {
      await saveBookingToCloud(newBookingRecord, nextBookings);
    } catch (err) {
      console.warn('Booking sync to cloud error:', err);
    }

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
            testimonials={testimonials}
            onUpdateSiteSettings={handleUpdateSiteSettings}
            onReplyTestimonial={handleReplyTestimonial}
            onDeleteTestimonial={handleDeleteTestimonial}
            onAddOutfit={async (newOutfit) => {
              setSelectedVibe('All Vibes');
              setSearchQuery('');
              setShowWishlistOnly(false);
              const nextOutfits = [newOutfit, ...outfits];
              setOutfits(nextOutfits);
              broadcastCatalogUpdate(nextOutfits);
              try {
                await saveOutfitToCloud(
                  newOutfit,
                  nextOutfits.map((o) => o.id),
                  nextOutfits
                );
              } catch (err) {
                console.error('Failed to sync new outfit to cloud:', err);
              }
            }}
            onUpdateOutfit={async (updatedOutfit) => {
              let nextOutfits: LehengaOutfit[] = [];
              setOutfits((prev) => {
                nextOutfits = prev.map((o) =>
                  o.id === updatedOutfit.id ? updatedOutfit : o
                );
                return nextOutfits;
              });
              broadcastCatalogUpdate(nextOutfits);
              try {
                await saveOutfitToCloud(
                  updatedOutfit,
                  nextOutfits.map((o) => o.id),
                  nextOutfits
                );
              } catch (err) {
                console.error('Failed to sync updated outfit to cloud:', err);
              }
            }}
            onDeleteOutfit={async (id) => {
              const nextOutfits = outfits.filter((o) => o.id !== id);
              setOutfits(nextOutfits);
              broadcastCatalogUpdate(nextOutfits);
              try {
                await deleteOutfitFromCloud(
                  id,
                  nextOutfits.map((o) => o.id),
                  nextOutfits
                );
              } catch (err) {
                console.error('Failed to sync deleted outfit to cloud:', err);
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
            siteSettings={siteSettings}
            wishlist={wishlist}
            onClose={handleCloseOutfitPage}
            onSelectOutfit={handleOpenOutfitPage}
            onRent={(o) => setRentalOutfit(o)}
            onShare={(o) => setShareOutfit(o)}
            isWishlisted={wishlist.includes(inspectOutfit.id)}
            onToggleWishlist={handleToggleWishlist}
            selectedDate={selectedEventDate}
            isBookedForDate={Boolean(
              inspectOutfit &&
              selectedEventDate &&
              isOutfitBookedOnDate(inspectOutfit, selectedEventDate, bookings)
            )}
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

              {/* Right Filter Controls: Small Circle Icons for Budget, Availability & Date Selection */}
              <div className="flex flex-wrap items-center justify-start md:justify-end gap-2.5 shrink-0">
                {/* Active Event Date Chip */}
                {selectedEventDate && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF0F5] border border-[#F8BBD0] text-[#D81B60] text-xs font-semibold shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setIsDatePopupOpen(true)}
                      className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer text-left"
                      title="Click to change rental date"
                      aria-label="Change rental date"
                    >
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{formatShortDate(selectedEventDate)}</span>
                      <span className="text-[10px] text-[#4A1525]/60 font-mono-num font-normal">
                        ({availableForDateCount} available)
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedEventDate('')}
                      className="ml-0.5 p-0.5 rounded-full hover:bg-[#F8BBD0]/60 text-[#D81B60] cursor-pointer"
                      title="Clear date filter"
                      aria-label="Clear date filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* 1. Small Circle Icon: Budget & Price Sort */}
                <div
                  className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-2xs group ${
                    sortBy !== 'featured'
                      ? 'bg-[#D81B60] border-[#D81B60] text-white shadow-xs'
                      : 'bg-white border-[#F8BBD0] text-[#4A1525] hover:border-[#D81B60] hover:bg-[#FFF0F5]'
                  }`}
                  title={
                    sortBy !== 'featured'
                      ? `Budget Filter: ${
                          sortBy === 'price-asc'
                            ? 'Low to High'
                            : sortBy === 'price-desc'
                            ? 'High to Low'
                            : sortBy === 'under-2000'
                            ? 'Under ₹2,000'
                            : sortBy === '2000-3500'
                            ? '₹2,000–₹3,500'
                            : 'Above ₹3,500'
                        }`
                      : 'Filter & Sort by Budget'
                  }
                >
                  <ArrowUpDown className="w-4 h-4 pointer-events-none" />
                  {sortBy !== 'featured' && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-white rounded-full border-2 border-[#D81B60]" />
                  )}
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(
                        e.target.value as
                          | 'featured'
                          | 'price-asc'
                          | 'price-desc'
                          | 'under-2000'
                          | '2000-3500'
                          | 'above-3500'
                      )
                    }
                    aria-label="Filter by Budget"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-full z-10"
                  >
                    <option value="featured">Budget: All / Featured</option>
                    <option value="price-asc">Budget: Low to High</option>
                    <option value="price-desc">Budget: High to Low</option>
                    <option value="under-2000">Under ₹2,000 / day</option>
                    <option value="2000-3500">₹2,000 – ₹3,500 / day</option>
                    <option value="above-3500">Above ₹3,500 / day</option>
                  </select>
                </div>

                {/* 2. Small Circle Icon: Availability Filter (Available / Booked Toggle) */}
                <div
                  className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-2xs group ${
                    availabilityFilter !== 'all'
                      ? 'bg-[#D81B60] border-[#D81B60] text-white shadow-xs'
                      : 'bg-white border-[#F8BBD0] text-[#4A1525] hover:border-[#D81B60] hover:bg-[#FFF0F5]'
                  }`}
                  title={
                    availabilityFilter === 'available'
                      ? 'Status: Available Only'
                      : availabilityFilter === 'booked'
                      ? 'Status: Booked Only'
                      : 'Status: Available & Booked (Click to filter)'
                  }
                >
                  <CheckCircle2 className="w-4 h-4 pointer-events-none" />
                  {availabilityFilter !== 'all' && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-white rounded-full border-2 border-[#D81B60]" />
                  )}
                  <select
                    value={availabilityFilter}
                    onChange={(e) =>
                      setAvailabilityFilter(e.target.value as 'all' | 'available' | 'booked')
                    }
                    aria-label="Filter by Availability"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-full z-10"
                  >
                    <option value="all">Status: All (Available & Booked)</option>
                    <option value="available">Status: Available Only</option>
                    <option value="booked">Status: Booked Only</option>
                  </select>
                </div>

                {/* 3. Small Circle Icon: Date Selection (Opens 'Lehenge me Slay kab kar rhi ho' Popup) */}
                <button
                  type="button"
                  onClick={() => setIsDatePopupOpen(true)}
                  className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-2xs group ${
                    selectedEventDate
                      ? 'bg-[#D81B60] border-[#D81B60] text-white shadow-xs'
                      : 'bg-white border-[#F8BBD0] text-[#4A1525] hover:border-[#D81B60] hover:bg-[#FFF0F5]'
                  }`}
                  title={
                    selectedEventDate
                      ? `Event Date Selected: ${formatShortDate(selectedEventDate)} (Click to change)`
                      : 'Pick Event Date to check outfit availability'
                  }
                  aria-label="Select Event Date"
                >
                  <Calendar className="w-4 h-4 pointer-events-none" />
                  {selectedEventDate && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-white rounded-full border-2 border-[#D81B60]" />
                  )}
                </button>

                {/* Clear Active Filters Button */}
                {(sortBy !== 'featured' || availabilityFilter !== 'all' || selectedEventDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('featured');
                      setAvailabilityFilter('all');
                      setSelectedEventDate('');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-[#4A1525] text-white text-xs font-semibold hover:bg-[#D81B60] transition-colors cursor-pointer"
                    title="Reset all filters"
                  >
                    <X className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
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
                  Try clearing your budget, date, or availability filters to explore all designs.
                </p>
                <button
                  onClick={() => {
                    setSelectedVibe('All Vibes');
                    setSelectedColor('All Colours');
                    setAvailabilityFilter('all');
                    setSortBy('featured');
                    setSelectedEventDate('');
                    setSearchQuery('');
                    setShowWishlistOnly(false);
                  }}
                  className="px-6 py-2.5 rounded-full bg-[#D81B60] text-white text-xs uppercase tracking-wider font-semibold hover:bg-[#AD1457] transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div
                ref={catalogGridRef}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7 lg:gap-8"
              >
                {filteredOutfits.map((outfit) => {
                  const isBookedForDate = selectedEventDate
                    ? isOutfitBookedOnDate(outfit, selectedEventDate, bookings)
                    : outfit.available === false;

                  return (
                    <ProductCard
                      key={outfit.id}
                      outfit={outfit}
                      onRent={(o) => setRentalOutfit(o)}
                      onShare={(o) => setShareOutfit(o)}
                      onInspect={handleOpenOutfitPage}
                      isWishlisted={wishlist.includes(outfit.id)}
                      onToggleWishlist={handleToggleWishlist}
                      selectedDate={selectedEventDate}
                      isBookedForDate={isBookedForDate}
                    />
                  );
                })}
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
          />
        </main>
      )}

      {/* Light Pink & White Luxury Footer with Dynamic Bottom Logo */}
      <footer className="bg-[#FCE4EC] text-[#4A1525] py-14 border-t border-[#F8BBD0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3.5">
              {siteSettings.bottomLogoUrl ? (
                <OptimizedImage
                  src={siteSettings.bottomLogoUrl}
                  alt={siteSettings.brandTitle || 'LOL By Sanjeevani'}
                  isLogo
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
                href={`https://wa.me/${formatWhatsAppUrlNumber(siteSettings.whatsappNumber)}?text=Hi%20LOL%20By%20Sanjeevani!%20I%20would%20like%20to%20book%20a%20lehenga%20trial%20in%20Indore.`}
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
        whatsappNumber={siteSettings.whatsappNumber}
        initialEventDate={selectedEventDate}
        bookings={bookings}
      />

      {/* Social & WhatsApp Share Modal */}
      <ShareModal outfit={shareOutfit} onClose={() => setShareOutfit(null)} />

      {/* FAQ Modal triggered from Bottom Footer */}
      <FaqModal isOpen={isFaqModalOpen} onClose={() => setIsFaqModalOpen(false)} />

      {/* 5-Second Slay Date Selection Popup */}
      <DateSelectionPopup
        isOpen={isDatePopupOpen}
        onClose={() => setIsDatePopupOpen(false)}
        onSelectDate={handlePopupDateSelect}
        currentSelectedDate={selectedEventDate}
      />

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
