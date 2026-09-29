import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
  setLogLevel,
  enableNetwork,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { LehengaOutfit, SiteSettings, CustomerTestimonial } from '../types';
import { BUNDLED_CATALOG_UPDATED_AT } from '../data/initialOutfits';
import heic2any from 'heic2any';

// Silence internal @firebase/firestore SDK console errors/warnings (e.g. free-tier quota backoff logs)
try {
  setLogLevel('silent');
} catch {
  // ignore
}

const WRITE_TOKEN = 'lol-sanjeevani-studio-sync-v1';
const QUOTA_EXHAUSTED_KEY = 'lol_firestore_quota_exhausted_until_v1';
const LOCAL_CATALOG_TIMESTAMP_KEY = 'lol_local_catalog_updated_at_v1';
const LOCAL_SETTINGS_TIMESTAMP_KEY = 'lol_local_settings_updated_at_v1';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

enableNetwork(db).catch(() => {});

let isWriteQuotaExhausted = (() => {
  try {
    const until = Number(sessionStorage.getItem(QUOTA_EXHAUSTED_KEY) || '0');
    return until > Date.now();
  } catch {
    return false;
  }
})();

let activeMutationsCount = 0;
let lastEmittedOutfitsJson = '';

function getLocalCatalogTimestamp(): number {
  try {
    return Number(localStorage.getItem(LOCAL_CATALOG_TIMESTAMP_KEY) || '0');
  } catch {
    return 0;
  }
}

function setLocalCatalogTimestamp(ts = Date.now()) {
  try {
    localStorage.setItem(LOCAL_CATALOG_TIMESTAMP_KEY, String(ts));
  } catch {
    // ignore
  }
}

function getLocalSettingsTimestamp(): number {
  try {
    return Number(localStorage.getItem(LOCAL_SETTINGS_TIMESTAMP_KEY) || '0');
  } catch {
    return 0;
  }
}

function setLocalSettingsTimestamp(ts = Date.now()) {
  try {
    localStorage.setItem(LOCAL_SETTINGS_TIMESTAMP_KEY, String(ts));
  } catch {
    // ignore
  }
}

function isQuotaError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    err instanceof Error
      ? `${err.name} ${err.message} ${(err as { code?: string }).code || ''}`
      : String(err);
  return (
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded')
  );
}

function tripWriteQuotaCircuitBreaker(err: unknown) {
  if (isQuotaError(err)) {
    isWriteQuotaExhausted = true;
    try {
      sessionStorage.setItem(QUOTA_EXHAUSTED_KEY, String(Date.now() + 60 * 60 * 1000));
    } catch {
      // ignore
    }
  }
}

async function runFirestoreWriteSafely(writeFn: () => Promise<void>): Promise<void> {
  if (isWriteQuotaExhausted) return;
  try {
    await Promise.race([
      writeFn(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('resource-exhausted')), 2000)
      ),
    ]);
  } catch (err) {
    tripWriteQuotaCircuitBreaker(err);
  }
}

// In-memory cache for resolved cloud-media:// Blob URLs
const resolvedMediaCache = new Map<string, string>();
const inflightMediaPromises = new Map<string, Promise<string>>();

/**
 * Compresses an image File in the browser using HTML5 Canvas to crisp WebP
 * so it uploads and syncs across all devices in milliseconds.
 */
async function compressImageFileToDataUrl(file: File, maxDimension = 1400): Promise<string> {
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
        const webpDataUrl = canvas.toDataURL('image/webp', 0.85);
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

function readBlobAsDataUrl(blob: Blob): Promise<string> {
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
    reader.readAsDataURL(blob);
  });
}

/**
 * Uploads any Blob/File in 1.5MB slices via `/api/upload-chunk` + `/api/upload-finalize`
 * so large videos (.mp4 / .mov / .webm) and high-res photos never fail due to HTTP payload limits.
 */
async function uploadViaChunkedServerApi(
  blob: Blob,
  prefix: string,
  fileName: string,
  mimeType: string
): Promise<string | null> {
  const CHUNK_BYTES = 1_500_000; // 1.5MB per request
  const totalChunks = Math.max(1, Math.ceil(blob.size / CHUNK_BYTES));
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  for (let i = 0; i < totalChunks; i++) {
    const slice = blob.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES);
    const sliceDataUrl = await readBlobAsDataUrl(slice);
    const commaIdx = sliceDataUrl.indexOf(',');
    const chunkBase64 = commaIdx !== -1 ? sliceDataUrl.slice(commaIdx + 1) : sliceDataUrl;

    const chunkRes = await fetch('/api/upload-chunk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        chunkIndex: i,
        chunkBase64,
      }),
    });
    if (!chunkRes.ok) {
      return null;
    }
  }

  const finalizeRes = await fetch('/api/upload-finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      prefix,
      mimeType,
      fileName,
    }),
  });
  if (!finalizeRes.ok) {
    return null;
  }
  const json = (await finalizeRes.json()) as { ok?: boolean; url?: string; dataUrl?: string };
  return json.dataUrl || json.url || null;
}

/**
 * Uploads any image or video File to local server (`/api/upload-media` or `/api/upload-chunk`)
 * and/or Firestore so it is immediately accessible without exhausting Firestore write quota.
 */
export async function uploadMediaToCloud(file: File, prefix = 'media'): Promise<string> {
  activeMutationsCount++;
  try {
    const lowerName = (file.name || '').toLowerCase();
    const lowerType = (file.type || '').toLowerCase();
    const isHeicFile =
      lowerType.includes('heic') ||
      lowerType.includes('heif') ||
      lowerName.endsWith('.heic') ||
      lowerName.endsWith('.heif');
    const isVideo =
      lowerType.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(lowerName);
    const isImage =
      !isVideo &&
      (lowerType.startsWith('image/') ||
        isHeicFile ||
        /\.(jpe?g|png|webp|gif|avif|heic|heif|svg)$/i.test(lowerName));

    // For videos, upload directly via chunked binary upload so 20MB–100MB .mp4/.mov files upload in < 1s
    if (isVideo) {
      try {
        const chunkedUrl = await uploadViaChunkedServerApi(
          file,
          prefix,
          file.name || 'video.mp4',
          file.type || 'video/mp4'
        );
        if (chunkedUrl) {
          return chunkedUrl;
        }
      } catch {
        // fallback below
      }
    }

    let dataUrl: string;
    if (isImage) {
      const maxDim = prefix.includes('logo') ? 600 : 1400;
      try {
        if (isHeicFile) {
          const converted = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.9,
          });
          const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
          const jpegFile = new File([jpegBlob], 'converted.jpg', { type: 'image/jpeg' });
          dataUrl = await compressImageFileToDataUrl(jpegFile, maxDim);
        } else {
          dataUrl = await compressImageFileToDataUrl(file, maxDim);
        }
      } catch {
        try {
          const converted = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.9,
          });
          const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
          const jpegFile = new File([jpegBlob], 'converted.jpg', { type: 'image/jpeg' });
          dataUrl = await compressImageFileToDataUrl(jpegFile, maxDim);
        } catch {
          // If client-side HEIC conversion failed, upload raw file via chunked server API (which converts via heic-convert on server)
          const serverConvertedUrl = await uploadViaChunkedServerApi(
            file,
            prefix,
            file.name || 'photo.heic',
            file.type || 'image/heic'
          );
          if (serverConvertedUrl) {
            return serverConvertedUrl;
          }
          dataUrl = await readBlobAsDataUrl(file);
        }
      }
    } else {
      dataUrl = await readBlobAsDataUrl(file);
    }

    // For images, return the compressed WebP dataUrl directly so it is stored permanently inside catalog.json & initialOutfits.ts
    if (isImage && dataUrl.startsWith('data:image/') && dataUrl.length <= 800_000) {
      return dataUrl;
    }

    // 1. Save directly to backend /api/upload-media first (immediate server sync, 0 Firestore write units)
    try {
      if (dataUrl.length <= 2_500_000) {
        const resp = await fetch('/api/upload-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl, prefix }),
        });
        if (resp.ok) {
          const json = (await resp.json()) as { ok?: boolean; url?: string; dataUrl?: string };
          if (json.dataUrl || json.url) {
            return (json.dataUrl || json.url)!;
          }
        }
      } else {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const chunkedUrl = await uploadViaChunkedServerApi(
          blob,
          prefix,
          file.name || 'media.webp',
          blob.type || file.type || 'image/webp'
        );
        if (chunkedUrl) {
          return chunkedUrl;
        }
      }
    } catch {
      // Backend API not reachable, continue to inline/Firestore
    }

    // 2. If image or Firestore quota is exhausted, return inline data URL or object URL
    if (isImage || isWriteQuotaExhausted) {
      return dataUrl;
    }

    // 3. Otherwise store in chunked Firestore media_assets collection
    const commaIdx = dataUrl.indexOf(',');
    const header = commaIdx !== -1 ? dataUrl.slice(0, commaIdx) : `data:${file.type};base64`;
    const base64Body = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    const mimeMatch = header.match(/^data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : file.type || 'application/octet-stream';

    const CHUNK_SIZE = 600_000;
    const totalChunks = Math.ceil(base64Body.length / CHUNK_SIZE);
    const assetId = `${prefix.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    const cloudUri = `cloud-media://${assetId}`;

    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      resolvedMediaCache.set(cloudUri, blobUrl);
    } catch {
      // ignore
    }

    try {
      for (let i = 0; i < totalChunks; i += 4) {
        const batch = writeBatch(db);
        for (let j = i; j < Math.min(i + 4, totalChunks); j++) {
          const chunkSlice = base64Body.slice(j * CHUNK_SIZE, (j + 1) * CHUNK_SIZE);
          const chunkRef = doc(
            db,
            'media_assets',
            assetId,
            'chunks',
            String(j).padStart(5, '0')
          );
          batch.set(chunkRef, {
            index: j,
            data: chunkSlice,
            writeToken: WRITE_TOKEN,
          });
        }
        await Promise.race([
          batch.commit(),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('resource-exhausted')), 2000)
          ),
        ]);
      }

      await Promise.race([
        setDoc(doc(db, 'media_assets', assetId), {
          mimeType,
          totalChunks,
          createdAt: Date.now(),
          writeToken: WRITE_TOKEN,
        }),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('resource-exhausted')), 2000)
        ),
      ]);
    } catch (err) {
      tripWriteQuotaCircuitBreaker(err);
      return dataUrl;
    }

    return cloudUri;
  } finally {
    activeMutationsCount = Math.max(0, activeMutationsCount - 1);
  }
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
    } catch {
      return uri;
    } finally {
      inflightMediaPromises.delete(uri);
    }
  })();

  inflightMediaPromises.set(uri, promise);
  return promise;
}

function sanitizeOutfitForFirestore(outfit: LehengaOutfit, sortOrder: number, nowTs: number) {
  return {
    id: String(outfit.id),
    code: String(outfit.color || outfit.code || ''),
    color: String(outfit.color || outfit.code || ''),
    title: String(outfit.title || ''),
    vibeCategory: String(outfit.vibeCategory || 'Navratri Ni Pehvesh'),
    pricePerDay: Number(outfit.pricePerDay) || 0,
    originalRetailPrice: 0,
    description: String(outfit.description || ''),
    ogHumorTagline: String(outfit.ogHumorTagline || ''),
    mediaUrl: String(outfit.mediaUrl || ''),
    mediaType: outfit.mediaType === 'video' ? 'video' : 'image',
    images: Array.isArray(outfit.images) ? outfit.images.map(String) : [],
    videoUrl: String(outfit.videoUrl || ''),
    sizes: Array.isArray(outfit.sizes) ? outfit.sizes.map(String) : [],
    available: outfit.available !== false,
    featured: false,
    sortOrder,
    updatedAt: nowTs,
    writeToken: WRITE_TOKEN,
  };
}

export async function saveOutfitToCloud(
  outfit: LehengaOutfit,
  allOutfitsOrder: string[],
  fullOutfitsList?: LehengaOutfit[]
): Promise<void> {
  const nowTs = Date.now();
  setLocalCatalogTimestamp(nowTs);
  activeMutationsCount++;

  try {
    if (Array.isArray(fullOutfitsList)) {
      lastEmittedOutfitsJson = JSON.stringify(fullOutfitsList);
    }
    try {
      const resp = await fetch(`/api/outfits/${encodeURIComponent(outfit.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outfit }),
      });
      if (resp.ok) {
        const updatedList = (await resp.json()) as LehengaOutfit[];
        if (Array.isArray(updatedList)) {
          lastEmittedOutfitsJson = JSON.stringify(updatedList);
        }
      }
    } catch {
      // ignore if static deployment
    }
  } finally {
    activeMutationsCount = Math.max(0, activeMutationsCount - 1);
  }

  // Fire-and-forget Firestore write so UI never waits on Firestore quota timeouts
  void runFirestoreWriteSafely(async () => {
    const sortOrder = Math.max(0, allOutfitsOrder.indexOf(outfit.id));
    const batch = writeBatch(db);

    batch.set(
      doc(db, 'outfits', outfit.id),
      sanitizeOutfitForFirestore(outfit, sortOrder, nowTs)
    );
    batch.set(doc(db, 'store_state', 'catalog_meta'), {
      initialized: true,
      outfitOrder: allOutfitsOrder,
      updatedAt: nowTs,
      writeToken: WRITE_TOKEN,
    });

    await batch.commit();
  });
}

export async function deleteOutfitFromCloud(
  outfitId: string,
  remainingOrder: string[],
  remainingOutfitsList?: LehengaOutfit[]
): Promise<void> {
  const nowTs = Date.now();
  setLocalCatalogTimestamp(nowTs);
  activeMutationsCount++;

  try {
    if (Array.isArray(remainingOutfitsList)) {
      lastEmittedOutfitsJson = JSON.stringify(remainingOutfitsList);
      try {
        await fetch('/api/outfits/sync', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outfits: remainingOutfitsList }),
        });
      } catch {
        // ignore if static deployment
      }
    }
  } finally {
    activeMutationsCount = Math.max(0, activeMutationsCount - 1);
  }

  void runFirestoreWriteSafely(async () => {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'outfits', outfitId));
    batch.set(doc(db, 'store_state', 'catalog_meta'), {
      initialized: true,
      outfitOrder: remainingOrder,
      updatedAt: nowTs,
      writeToken: WRITE_TOKEN,
    });
    await batch.commit();
  });
}

export async function saveAllOutfitsToCloud(outfits: LehengaOutfit[]): Promise<void> {
  const nowTs = Date.now();
  setLocalCatalogTimestamp(nowTs);
  lastEmittedOutfitsJson = JSON.stringify(outfits);

  try {
    await fetch('/api/outfits/sync', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outfits }),
    });
  } catch {
    // ignore if static deployment
  }

  void runFirestoreWriteSafely(async () => {
    const batch = writeBatch(db);
    const outfitOrder = outfits.map((o) => o.id);

    outfits.forEach((outfit, idx) => {
      batch.set(doc(db, 'outfits', outfit.id), sanitizeOutfitForFirestore(outfit, idx, nowTs));
    });

    batch.set(doc(db, 'store_state', 'catalog_meta'), {
      initialized: true,
      outfitOrder,
      updatedAt: nowTs,
      writeToken: WRITE_TOKEN,
    });

    await batch.commit();
  });
}

export async function saveSiteSettingsToCloud(settings: SiteSettings): Promise<void> {
  const nowTs = Date.now();
  setLocalSettingsTimestamp(nowTs);

  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  } catch {
    // ignore if static deployment
  }

  void runFirestoreWriteSafely(async () => {
    await setDoc(doc(db, 'store_state', 'settings'), {
      settings,
      updatedAt: nowTs,
      writeToken: WRITE_TOKEN,
    });
  });
}

export async function saveTestimonialsToCloud(
  testimonials: CustomerTestimonial[]
): Promise<void> {
  try {
    await fetch('/api/testimonials/sync', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testimonials }),
    });
  } catch {
    // ignore if static deployment
  }

  void runFirestoreWriteSafely(async () => {
    await setDoc(doc(db, 'store_state', 'testimonials'), {
      items: testimonials,
      updatedAt: Date.now(),
      writeToken: WRITE_TOKEN,
    });
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
 * Subscribes to live updates from both the backend server (`/api/*`) and Firestore.
 * Ensures stale Firestore documents or identical polls never reset active uploads.
 */
export function subscribeToLiveStore({
  initialOutfits,
  onOutfitsChange,
  onSettingsChange,
  onTestimonialsChange,
}: LiveStoreCallbacks): () => void {
  let isDisposed = false;
  let hasLiveBackendServer = false;
  lastEmittedOutfitsJson = JSON.stringify(initialOutfits);
  let lastEmittedSettingsJson = '';
  let lastEmittedTestimonialsJson = '';

  const emitIfChanged = (nextOutfits: LehengaOutfit[]) => {
    if (activeMutationsCount > 0) return;
    const nextJson = JSON.stringify(nextOutfits);
    if (nextJson === lastEmittedOutfitsJson) return;
    lastEmittedOutfitsJson = nextJson;
    onOutfitsChange(nextOutfits);
  };

  const syncWithBackendServer = async () => {
    if (activeMutationsCount > 0 || isDisposed) return;
    try {
      const [outfitsRes, settingsRes, testimonialsRes] = await Promise.all([
        fetch('/api/outfits', { cache: 'no-store' }),
        fetch('/api/settings', { cache: 'no-store' }),
        fetch('/api/testimonials', { cache: 'no-store' }),
      ]);

      if (isDisposed || activeMutationsCount > 0) return;

      if (
        outfitsRes.ok &&
        (outfitsRes.headers.get('content-type') || '').includes('application/json')
      ) {
        hasLiveBackendServer = true;
        const serverOutfits = (await outfitsRes.json()) as LehengaOutfit[];
        if (Array.isArray(serverOutfits) && serverOutfits.length > 0) {
          emitIfChanged(serverOutfits);
        }
      }

      if (
        settingsRes.ok &&
        (settingsRes.headers.get('content-type') || '').includes('application/json')
      ) {
        hasLiveBackendServer = true;
        const serverSettings = (await settingsRes.json()) as SiteSettings;
        if (serverSettings && typeof serverSettings === 'object') {
          const nextSettingsJson = JSON.stringify(serverSettings);
          if (nextSettingsJson !== lastEmittedSettingsJson) {
            lastEmittedSettingsJson = nextSettingsJson;
            onSettingsChange(serverSettings);
          }
        }
      }

      if (
        testimonialsRes.ok &&
        (testimonialsRes.headers.get('content-type') || '').includes('application/json')
      ) {
        hasLiveBackendServer = true;
        const serverTestimonials = (await testimonialsRes.json()) as CustomerTestimonial[];
        if (Array.isArray(serverTestimonials) && serverTestimonials.length > 0) {
          const nextTestJson = JSON.stringify(serverTestimonials);
          if (nextTestJson !== lastEmittedTestimonialsJson) {
            lastEmittedTestimonialsJson = nextTestJson;
            onTestimonialsChange(serverTestimonials);
          }
        }
      }
    } catch {
      // Static environment without /api routes
    }
  };

  syncWithBackendServer();

  const pollTimer = setInterval(() => {
    syncWithBackendServer();
  }, 1500);

  const handleWindowFocus = () => {
    syncWithBackendServer();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleWindowFocus);
  }

  if (isWriteQuotaExhausted) {
    return () => {
      isDisposed = true;
      clearInterval(pollTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleWindowFocus);
        document.removeEventListener('visibilitychange', handleWindowFocus);
      }
    };
  }

  let latestOutfitsMap = new Map<string, LehengaOutfit & { sortOrder?: number; updatedAt?: number }>();
  let latestOutfitOrder: string[] | null = null;
  let latestMetaUpdatedAt = 0;
  let catalogMetaLoaded = false;
  let outfitsCollectionLoaded = false;

  const emitOrderedOutfits = () => {
    if (hasLiveBackendServer) {
      // When connected to the live Express server (ais-dev / ais-pre), /api/outfits is authoritative
      return;
    }
    if (!catalogMetaLoaded || !outfitsCollectionLoaded) return;
    if (latestOutfitsMap.size === 0 || activeMutationsCount > 0) return;

    const minValidTimestamp = Math.max(getLocalCatalogTimestamp(), BUNDLED_CATALOG_UPDATED_AT);
    if (latestMetaUpdatedAt < minValidTimestamp) {
      // Firestore holds stale documents from before the daily write quota was reached;
      // keep the newer bundled/server catalog instead of reverting to old drafts.
      return;
    }

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

    emitIfChanged(allDocs);
  };

  const unsubMeta = onSnapshot(
    doc(db, 'store_state', 'catalog_meta'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      latestOutfitOrder = Array.isArray(data.outfitOrder) ? data.outfitOrder : null;
      latestMetaUpdatedAt = typeof data.updatedAt === 'number' ? data.updatedAt : 0;
      catalogMetaLoaded = true;
      emitOrderedOutfits();
    },
    (err) => {
      tripWriteQuotaCircuitBreaker(err);
    }
  );

  const unsubOutfits = onSnapshot(
    collection(db, 'outfits'),
    (snap) => {
      const nextMap = new Map<string, LehengaOutfit & { sortOrder?: number; updatedAt?: number }>();
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        nextMap.set(docSnap.id, {
          id: d.id || docSnap.id,
          code: d.color || d.code || '',
          color: d.color || d.code || '',
          title: d.title || '',
          vibeCategory: d.vibeCategory || 'Navratri Ni Pehvesh',
          pricePerDay: Number(d.pricePerDay) || 0,
          description: d.description || '',
          ogHumorTagline: d.ogHumorTagline || '',
          mediaUrl: d.mediaUrl || '',
          mediaType: d.mediaType === 'video' ? 'video' : 'image',
          images: Array.isArray(d.images) ? d.images : [],
          videoUrl: d.videoUrl || '',
          sizes: Array.isArray(d.sizes) ? d.sizes : [],
          available: d.available !== false,
          createdAt: d.createdAt || new Date().toISOString(),
          sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 9999,
          updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : 0,
        });
      });
      latestOutfitsMap = nextMap;
      outfitsCollectionLoaded = true;
      emitOrderedOutfits();
    },
    (err) => {
      tripWriteQuotaCircuitBreaker(err);
    }
  );

  const unsubSettings = onSnapshot(
    doc(db, 'store_state', 'settings'),
    (snap) => {
      if (hasLiveBackendServer || !snap.exists()) return;
      const data = snap.data();
      const remoteTs = typeof data?.updatedAt === 'number' ? data.updatedAt : 0;
      const localTs = Math.max(getLocalSettingsTimestamp(), BUNDLED_CATALOG_UPDATED_AT);
      if (remoteTs < localTs) {
        return;
      }
      if (data?.settings && typeof data.settings === 'object') {
        onSettingsChange(data.settings as SiteSettings);
      }
    },
    (err) => {
      tripWriteQuotaCircuitBreaker(err);
    }
  );

  const unsubTestimonials = onSnapshot(
    doc(db, 'store_state', 'testimonials'),
    (snap) => {
      if (hasLiveBackendServer || !snap.exists()) return;
      const data = snap.data();
      if (Array.isArray(data?.items)) {
        onTestimonialsChange(data.items as CustomerTestimonial[]);
      }
    },
    (err) => {
      tripWriteQuotaCircuitBreaker(err);
    }
  );

  return () => {
    isDisposed = true;
    clearInterval(pollTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleWindowFocus);
    }
    unsubMeta();
    unsubOutfits();
    unsubSettings();
    unsubTestimonials();
  };
}
