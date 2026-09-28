import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { LehengaOutfit, SiteSettings, CustomerTestimonial } from '../types';

const WRITE_TOKEN = 'lol-sanjeevani-studio-sync-v1';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// In-memory cache for resolved cloud-media:// Blob URLs
const resolvedMediaCache = new Map<string, string>();
const inflightMediaPromises = new Map<string, Promise<string>>();

/**
 * Compresses an image File in the browser using HTML5 Canvas to crisp WebP
 * so it uploads and syncs across all devices in milliseconds.
 */
async function compressImageFileToDataUrl(file: File, maxDimension = 1920): Promise<string> {
  if (file.type === 'image/svg+xml') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read SVG file'));
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const webpDataUrl = canvas.toDataURL('image/webp', 0.92);
        URL.revokeObjectURL(objectUrl);
        resolve(webpDataUrl);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to decode image'));
    };
    img.src = objectUrl;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads any image or video File to Firestore so that it is immediately
 * accessible on Vercel and all connected browsers within seconds.
 */
export async function uploadMediaToCloud(file: File, prefix = 'media'): Promise<string> {
  const isImage = file.type.startsWith('image/');
  let dataUrl: string;

  if (isImage) {
    try {
      const maxDim = prefix.includes('logo') ? 600 : 1280;
      dataUrl = await compressImageFileToDataUrl(file, maxDim);
    } catch {
      dataUrl = await readFileAsDataUrl(file);
    }

    // If compressed WebP is compact (< 180KB), return inline data URL directly for zero-latency rendering
    if (dataUrl.length <= 180_000) {
      return dataUrl;
    }
  } else {
    dataUrl = await readFileAsDataUrl(file);
  }

  // For larger images or videos (.mp4/.webm), store in chunked Firestore media_assets collection
  const commaIdx = dataUrl.indexOf(',');
  const header = commaIdx !== -1 ? dataUrl.slice(0, commaIdx) : `data:${file.type};base64`;
  const base64Body = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const mimeMatch = header.match(/^data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : file.type || 'application/octet-stream';

  const CHUNK_SIZE = 600_000; // ~600KB per Firestore document (well under 1 MiB limit)
  const totalChunks = Math.ceil(base64Body.length / CHUNK_SIZE);
  const assetId = `${prefix.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  // Upload chunks in batches of 4
  for (let i = 0; i < totalChunks; i += 4) {
    const batch = writeBatch(db);
    for (let j = i; j < Math.min(i + 4, totalChunks); j++) {
      const chunkSlice = base64Body.slice(j * CHUNK_SIZE, (j + 1) * CHUNK_SIZE);
      const chunkRef = doc(db, 'media_assets', assetId, 'chunks', String(j).padStart(5, '0'));
      batch.set(chunkRef, {
        index: j,
        data: chunkSlice,
        writeToken: WRITE_TOKEN,
      });
    }
    await batch.commit();
  }

  await setDoc(doc(db, 'media_assets', assetId), {
    mimeType,
    totalChunks,
    createdAt: Date.now(),
    writeToken: WRITE_TOKEN,
  });

  const cloudUri = `cloud-media://${assetId}`;

  // Pre-populate local cache with a Blob URL so the uploading browser sees it immediately
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    resolvedMediaCache.set(cloudUri, blobUrl);
  } catch {
    // ignore
  }

  return cloudUri;
}

/**
 * Resolves a `cloud-media://<assetId>` URI into a playable/renderable Blob URL
 * by downloading and reassembling its chunks from Firestore.
 */
export async function resolveCloudMediaUrl(uri: string): Promise<string> {
  if (!uri || !uri.startsWith('cloud-media://')) {
    return uri;
  }

  const cached = resolvedMediaCache.get(uri);
  if (cached) return cached;

  const inflight = inflightMediaPromises.get(uri);
  if (inflight) return inflight;

  const assetId = uri.replace('cloud-media://', '').trim();
  const promise = (async () => {
    try {
      const metaSnap = await getDoc(doc(db, 'media_assets', assetId));
      if (!metaSnap.exists()) {
        return uri;
      }
      const { mimeType = 'video/mp4' } = metaSnap.data() as {
        mimeType?: string;
        totalChunks?: number;
      };

      const chunksQuery = query(
        collection(db, 'media_assets', assetId, 'chunks'),
        orderBy('index', 'asc')
      );
      const chunksSnap = await getDocs(chunksQuery);
      if (chunksSnap.empty) return uri;

      const sortedChunks: string[] = [];
      chunksSnap.forEach((docSnap) => {
        const d = docSnap.data();
        if (typeof d.data === 'string') {
          sortedChunks.push(d.data);
        }
      });

      const fullBase64 = sortedChunks.join('');
      const byteCharacters = atob(fullBase64);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteNumbers], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      resolvedMediaCache.set(uri, blobUrl);
      return blobUrl;
    } catch (err) {
      console.error('Failed to resolve cloud media:', err);
      return uri;
    } finally {
      inflightMediaPromises.delete(uri);
    }
  })();

  inflightMediaPromises.set(uri, promise);
  return promise;
}

/**
 * Sanitizes an outfit object before writing to Firestore.
 */
function sanitizeOutfitForFirestore(outfit: LehengaOutfit, sortOrder: number) {
  return {
    id: String(outfit.id),
    code: String(outfit.code || ''),
    title: String(outfit.title || ''),
    vibeCategory: String(outfit.vibeCategory || 'Navratri Ni Pehvesh'),
    pricePerDay: Number(outfit.pricePerDay) || 0,
    originalRetailPrice: Number(outfit.originalRetailPrice) || 0,
    description: String(outfit.description || ''),
    ogHumorTagline: String(outfit.ogHumorTagline || ''),
    mediaUrl: String(outfit.mediaUrl || ''),
    mediaType: outfit.mediaType === 'video' ? 'video' : 'image',
    images: Array.isArray(outfit.images) ? outfit.images.map(String) : [],
    videoUrl: String(outfit.videoUrl || ''),
    sizes: Array.isArray(outfit.sizes) ? outfit.sizes.map(String) : [],
    available: Boolean(outfit.available),
    featured: Boolean(outfit.featured),
    sortOrder,
    updatedAt: Date.now(),
    writeToken: WRITE_TOKEN,
  };
}

export async function saveOutfitToCloud(
  outfit: LehengaOutfit,
  allOutfitsOrder: string[]
): Promise<void> {
  const sortOrder = Math.max(0, allOutfitsOrder.indexOf(outfit.id));
  const batch = writeBatch(db);

  batch.set(
    doc(db, 'outfits', outfit.id),
    sanitizeOutfitForFirestore(outfit, sortOrder)
  );
  batch.set(doc(db, 'store_state', 'catalog_meta'), {
    initialized: true,
    outfitOrder: allOutfitsOrder,
    updatedAt: Date.now(),
    writeToken: WRITE_TOKEN,
  });

  await batch.commit();
}

export async function deleteOutfitFromCloud(
  outfitId: string,
  remainingOrder: string[]
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'outfits', outfitId));
  batch.set(doc(db, 'store_state', 'catalog_meta'), {
    initialized: true,
    outfitOrder: remainingOrder,
    updatedAt: Date.now(),
    writeToken: WRITE_TOKEN,
  });
  await batch.commit();
}

export async function saveAllOutfitsToCloud(outfits: LehengaOutfit[]): Promise<void> {
  const batch = writeBatch(db);
  const outfitOrder = outfits.map((o) => o.id);

  outfits.forEach((outfit, idx) => {
    batch.set(doc(db, 'outfits', outfit.id), sanitizeOutfitForFirestore(outfit, idx));
  });

  batch.set(doc(db, 'store_state', 'catalog_meta'), {
    initialized: true,
    outfitOrder,
    updatedAt: Date.now(),
    writeToken: WRITE_TOKEN,
  });

  await batch.commit();
}

export async function saveSiteSettingsToCloud(settings: SiteSettings): Promise<void> {
  await setDoc(doc(db, 'store_state', 'settings'), {
    settings,
    updatedAt: Date.now(),
    writeToken: WRITE_TOKEN,
  });
}

export async function saveTestimonialsToCloud(
  testimonials: CustomerTestimonial[]
): Promise<void> {
  await setDoc(doc(db, 'store_state', 'testimonials'), {
    items: testimonials,
    updatedAt: Date.now(),
    writeToken: WRITE_TOKEN,
  });
}

interface LiveStoreCallbacks {
  initialOutfits: LehengaOutfit[];
  initialSettings: SiteSettings;
  initialTestimonials: CustomerTestimonial[];
  onOutfitsChange: (outfits: LehengaOutfit[]) => void;
  onSettingsChange: (settings: SiteSettings) => void;
  onTestimonialsChange: (testimonials: CustomerTestimonial[]) => void;
}

/**
 * Subscribes to real-time Firestore updates across outfits, site settings, and testimonials.
 * Any change in the Admin Dashboard immediately propagates to all connected clients (including Vercel)
 * in under 1 second via Firestore WebSockets.
 */
export function subscribeToLiveStore({
  initialOutfits,
  initialSettings,
  initialTestimonials,
  onOutfitsChange,
  onSettingsChange,
  onTestimonialsChange,
}: LiveStoreCallbacks): () => void {
  let latestOutfitsMap = new Map<string, LehengaOutfit & { sortOrder?: number }>();
  let latestOutfitOrder: string[] | null = null;
  let catalogMetaLoaded = false;
  let outfitsCollectionLoaded = false;
  let isSeedingCatalog = false;

  const emitOrderedOutfits = () => {
    if (!catalogMetaLoaded || !outfitsCollectionLoaded) return;

    const allDocs = Array.from(latestOutfitsMap.values());
    if (latestOutfitOrder && latestOutfitOrder.length > 0) {
      const orderMap = new Map<string, number>();
      latestOutfitOrder.forEach((id, idx) => orderMap.set(id, idx));
      allDocs.sort((a, b) => {
        const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : (a.sortOrder ?? 9999);
        const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : (b.sortOrder ?? 9999);
        return idxA - idxB;
      });
    } else {
      allDocs.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
    }

    onOutfitsChange(allDocs);
  };

  // 1. Listen to catalog_meta document
  const unsubMeta = onSnapshot(
    doc(db, 'store_state', 'catalog_meta'),
    async (snap) => {
      if (!snap.exists()) {
        if (!isSeedingCatalog) {
          isSeedingCatalog = true;
          try {
            await saveAllOutfitsToCloud(initialOutfits);
          } catch (err) {
            console.error('Initial catalog seed error:', err);
          }
        }
        return;
      }
      const data = snap.data();
      latestOutfitOrder = Array.isArray(data.outfitOrder) ? data.outfitOrder : null;
      catalogMetaLoaded = true;
      emitOrderedOutfits();
    },
    (err) => {
      console.error('Firestore catalog_meta listener error:', err);
    }
  );

  // 2. Listen to outfits collection in real time
  const unsubOutfits = onSnapshot(
    collection(db, 'outfits'),
    (snap) => {
      const nextMap = new Map<string, LehengaOutfit & { sortOrder?: number }>();
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        nextMap.set(docSnap.id, {
          id: d.id || docSnap.id,
          code: d.code || '',
          title: d.title || '',
          vibeCategory: d.vibeCategory || 'Navratri Ni Pehvesh',
          pricePerDay: Number(d.pricePerDay) || 0,
          originalRetailPrice: Number(d.originalRetailPrice) || 0,
          description: d.description || '',
          ogHumorTagline: d.ogHumorTagline || '',
          mediaUrl: d.mediaUrl || '',
          mediaType: d.mediaType === 'video' ? 'video' : 'image',
          images: Array.isArray(d.images) ? d.images : [],
          videoUrl: d.videoUrl || '',
          sizes: Array.isArray(d.sizes) ? d.sizes : [],
          available: Boolean(d.available),
          featured: Boolean(d.featured),
          sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 9999,
        });
      });
      latestOutfitsMap = nextMap;
      outfitsCollectionLoaded = true;
      emitOrderedOutfits();
    },
    (err) => {
      console.error('Firestore outfits listener error:', err);
    }
  );

  // 3. Listen to site settings in real time
  let isSeedingSettings = false;
  const unsubSettings = onSnapshot(
    doc(db, 'store_state', 'settings'),
    async (snap) => {
      if (!snap.exists()) {
        if (!isSeedingSettings) {
          isSeedingSettings = true;
          try {
            await saveSiteSettingsToCloud(initialSettings);
          } catch (err) {
            console.error('Initial settings seed error:', err);
          }
        }
        return;
      }
      const data = snap.data();
      if (data?.settings && typeof data.settings === 'object') {
        onSettingsChange(data.settings as SiteSettings);
      }
    },
    (err) => {
      console.error('Firestore settings listener error:', err);
    }
  );

  // 4. Listen to customer testimonials in real time
  let isSeedingTestimonials = false;
  const unsubTestimonials = onSnapshot(
    doc(db, 'store_state', 'testimonials'),
    async (snap) => {
      if (!snap.exists()) {
        if (!isSeedingTestimonials) {
          isSeedingTestimonials = true;
          try {
            await saveTestimonialsToCloud(initialTestimonials);
          } catch (err) {
            console.error('Initial testimonials seed error:', err);
          }
        }
        return;
      }
      const data = snap.data();
      if (Array.isArray(data?.items)) {
        onTestimonialsChange(data.items as CustomerTestimonial[]);
      }
    },
    (err) => {
      console.error('Firestore testimonials listener error:', err);
    }
  );

  return () => {
    unsubMeta();
    unsubOutfits();
    unsubSettings();
    unsubTestimonials();
  };
}
