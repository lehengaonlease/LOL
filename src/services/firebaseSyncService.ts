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
  disableNetwork,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { LehengaOutfit, SiteSettings, CustomerTestimonial, RentalBooking } from '../types';
import { INITIAL_OUTFITS, BUNDLED_CATALOG_UPDATED_AT } from '../data/initialOutfits';
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
export const storage = getStorage(app, firebaseConfig.storageBucket);

// Daily free tier quota resets at midnight US Pacific Time: 2026-10-06T08:00:00.000Z
const KNOWN_QUOTA_RESET_TIMESTAMP = 1791273600000;

let isWriteQuotaExhausted = (() => {
  if (Date.now() < KNOWN_QUOTA_RESET_TIMESTAMP) {
    return true;
  }
  try {
    const until = Number(
      localStorage.getItem(QUOTA_EXHAUSTED_KEY) ||
      sessionStorage.getItem(QUOTA_EXHAUSTED_KEY) ||
      '0'
    );
    return until > Date.now();
  } catch {
    return false;
  }
})();

if (isWriteQuotaExhausted) {
  // Proactively disable Firestore network to shut down gRPC connections and eliminate RPC 'Write' stream errors
  disableNetwork(db).catch(() => {});
} else {
  enableNetwork(db).catch(() => {});
}

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
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes("RpcConnection RPC 'Write'") ||
    msg.includes("GrpcConnection RPC 'Write'")
  );
}

function tripWriteQuotaCircuitBreaker(err?: unknown) {
  if (!err || isQuotaError(err)) {
    isWriteQuotaExhausted = true;
    try {
      const until = String(Math.max(KNOWN_QUOTA_RESET_TIMESTAMP, Date.now() + 24 * 60 * 60 * 1000));
      localStorage.setItem(QUOTA_EXHAUSTED_KEY, until);
      sessionStorage.setItem(QUOTA_EXHAUSTED_KEY, until);
    } catch {
      // ignore
    }
    // Shut down gRPC streams so Firestore stops throwing RPC 'Write' stream errors
    disableNetwork(db).catch(() => {});
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

// In-memory cache for resolved legacy cloud-media:// Blob URLs
const resolvedMediaCache = new Map<string, string>();
const inflightMediaPromises = new Map<string, Promise<string>>();

export type UploadProgressCallback = (loadedBytes: number, totalBytes: number) => void;

export function formatUploadMB(loadedBytes: number, totalBytes: number): string {
  const totalMB = Math.max(0.01, totalBytes / (1024 * 1024));
  const loadedMB = Math.min(totalMB, Math.max(0, loadedBytes / (1024 * 1024)));
  const pct = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;
  return `${loadedMB.toFixed(2)} MB / ${totalMB.toFixed(2)} MB (${pct}%)`;
}

let isStorageBucketUnavailable = false;

function sendBinaryChunkWithProgress(
  chunkBlob: Blob,
  uploadId: string,
  chunkIndex: number,
  onChunkProgress?: (chunkLoaded: number) => void
): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload-binary-chunk', true);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('X-Upload-Id', uploadId);
    xhr.setRequestHeader('X-Chunk-Index', String(chunkIndex));

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onChunkProgress) {
        onChunkProgress(ev.loaded);
      }
    };

    xhr.onload = () => {
      resolve(xhr.status >= 200 && xhr.status < 300);
    };
    xhr.onerror = () => resolve(false);
    xhr.ontimeout = () => resolve(false);
    xhr.send(chunkBlob);
  });
}

function sendDirectBinaryWithProgress(
  fileBlob: Blob,
  prefix: string,
  fileName: string,
  onProgress?: UploadProgressCallback
): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload-binary', true);
    xhr.setRequestHeader('Content-Type', fileBlob.type || 'application/octet-stream');
    xhr.setRequestHeader('X-Prefix', prefix);
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(fileName));

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) {
        onProgress(ev.loaded, ev.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res && res.url) {
            resolve(res.url);
            return;
          }
        } catch {
          // ignore
        }
      }
      resolve(null);
    };
    xhr.onerror = () => resolve(null);
    xhr.ontimeout = () => resolve(null);
    xhr.send(fileBlob);
  });
}

/**
 * Streams raw binary File/Blob to the live server with real-time byte progress.
 * For files <= 25MB: uploads via fast single-stream direct POST `/api/upload-binary` (<500ms).
 * For files > 25MB: streams in 4MB binary slices via `/api/upload-binary-chunk` + `/api/upload-binary-finalize`.
 */
async function uploadRawBinaryToServer(
  blob: Blob,
  prefix: string,
  fileName: string,
  mimeType: string,
  onProgress?: UploadProgressCallback
): Promise<string | null> {
  try {
    const totalBytes = Math.max(1, blob.size);
    onProgress?.(0, totalBytes);

    // Fast-path: single stream direct binary POST for files <= 25MB
    if (totalBytes <= 25 * 1024 * 1024) {
      const directUrl = await sendDirectBinaryWithProgress(blob, prefix, fileName, onProgress);
      if (directUrl) {
        onProgress?.(totalBytes, totalBytes);
        return directUrl;
      }
    }

    // Chunked path for larger files (>25MB)
    const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB binary slices
    const totalChunks = Math.max(1, Math.ceil(totalBytes / CHUNK_SIZE));
    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(totalBytes, (i + 1) * CHUNK_SIZE);
      const slice = blob.slice(start, end);

      const ok = await sendBinaryChunkWithProgress(slice, uploadId, i, (chunkLoaded) => {
        onProgress?.(Math.min(totalBytes, start + chunkLoaded), totalBytes);
      });
      if (!ok) {
        return null;
      }
      onProgress?.(end, totalBytes);
    }

    const finalizeRes = await fetch('/api/upload-binary-finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        prefix,
        mimeType,
        fileName,
      }),
    });
    if (!finalizeRes.ok) return null;
    const data = (await finalizeRes.json()) as { ok?: boolean; url?: string };
    if (!data.url) return null;
    return data.url;
  } catch {
    return null;
  }
}

/**
 * Uploads a raw JavaScript File/Blob directly to Firebase Storage using the modular v9/v10+ SDK
 * (`ref`, `uploadBytesResumable`, `getDownloadURL`) and returns a permanent HTTPS URL.
 * Reports live MB progress via `onProgress(loadedBytes, totalBytes)`.
 */
export async function uploadMediaToCloud(
  file: File,
  prefix = 'lehengas',
  onProgress?: UploadProgressCallback
): Promise<string> {
  activeMutationsCount++;
  try {
    let uploadBlob: Blob = file;
    let safeFileName = (file.name || 'media').replace(/[^a-zA-Z0-9._-]/g, '_');
    let contentType = file.type || 'application/octet-stream';

    const lowerName = safeFileName.toLowerCase();
    const lowerType = contentType.toLowerCase();
    const isHeicFile =
      lowerType.includes('heic') ||
      lowerType.includes('heif') ||
      lowerName.endsWith('.heic') ||
      lowerName.endsWith('.heif');

    onProgress?.(0, Math.max(1, file.size));

    // Convert raw HEIC/HEIF Blob to standard JPEG Blob in binary form (no Base64)
    if (isHeicFile) {
      try {
        const converted = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.9,
        });
        uploadBlob = Array.isArray(converted) ? converted[0] : converted;
        safeFileName = safeFileName.replace(/\.(heic|heif)$/i, '.jpg');
        contentType = 'image/jpeg';
      } catch {
        // Server binary endpoint also handles HEIC buffer conversion if browser conversion fails
      }
    }

    const sanitizedPrefix = prefix.replace(/[^a-zA-Z0-9/_-]/g, '') || 'lehengas';

    // 1. Primary: Stream binary chunks directly to live server with real-time XHR MB progress
    const binaryServerUrl = await uploadRawBinaryToServer(
      uploadBlob,
      sanitizedPrefix,
      safeFileName,
      contentType,
      onProgress
    );
    if (binaryServerUrl) {
      return binaryServerUrl;
    }

    // 2. Official Firebase Storage upload pipeline (`ref` -> `uploadBytesResumable` -> `getDownloadURL`)
    if (!isStorageBucketUnavailable) {
      const storagePath = `lehengas/${sanitizedPrefix}_${Date.now()}_${safeFileName}`;
      try {
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, uploadBlob, { contentType });
        uploadTask.on('state_changed', (snap) => {
          onProgress?.(snap.bytesTransferred, snap.totalBytes);
        });
        await uploadTask;
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        if (downloadURL && downloadURL.startsWith('http')) {
          return downloadURL;
        }
      } catch {
        isStorageBucketUnavailable = true;
      }
    }

    throw new Error('Failed to upload media file');
  } finally {
    activeMutationsCount = Math.max(0, activeMutationsCount - 1);
  }
}

export function normalizeMediaUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  const uploadsMatch = trimmed.match(/^https?:\/\/[^/]+(\/uploads\/.+)$/i);
  if (uploadsMatch) {
    return uploadsMatch[1];
  }
  return trimmed;
}

/**
 * Resolves a `cloud-media://<assetId>` URI or a `/uploads/<filename>` URL into a playable/renderable Blob URL
 * by downloading and reassembling its chunks from Firestore `media_assets`.
 */
export async function resolveCloudMediaUrl(uri: string): Promise<string> {
  if (!uri) return uri;

  let assetId = '';
  if (uri.startsWith('cloud-media://')) {
    assetId = uri.replace('cloud-media://', '').trim();
  } else {
    const normalized = normalizeMediaUrl(uri);
    if (normalized.startsWith('/uploads/')) {
      assetId = normalized.replace('/uploads/', '').split('?')[0].trim();
    }
  }

  if (!assetId) {
    return uri;
  }

  const safeAssetId = assetId.replace(/[^a-zA-Z0-9._-]/g, '_');
  const cacheKey = `cloud-media://${safeAssetId}`;

  const cached = resolvedMediaCache.get(cacheKey);
  if (cached) return cached;

  const inflight = inflightMediaPromises.get(cacheKey);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      let targetId = safeAssetId;
      let metaSnap = await getDoc(doc(db, 'media_assets', targetId));
      if (!metaSnap.exists() && !targetId.includes('.')) {
        const webpSnap = await getDoc(doc(db, 'media_assets', `${targetId}.webp`));
        if (webpSnap.exists()) {
          targetId = `${targetId}.webp`;
          metaSnap = webpSnap;
        }
      }
      if (!metaSnap.exists()) {
        return uri;
      }
      const { mimeType = targetId.endsWith('.mp4') ? 'video/mp4' : 'image/webp' } =
        metaSnap.data() as {
          mimeType?: string;
          totalChunks?: number;
        };

      const chunksQuery = query(
        collection(db, 'media_assets', targetId, 'chunks'),
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
      resolvedMediaCache.set(cacheKey, blobUrl);
      return blobUrl;
    } catch {
      return uri;
    } finally {
      inflightMediaPromises.delete(cacheKey);
    }
  })();

  inflightMediaPromises.set(cacheKey, promise);
  return promise;
}

function sanitizeOutfitForFirestore(outfit: LehengaOutfit, sortOrder: number, nowTs: number) {
  const rawImages =
    Array.isArray(outfit.mediaUrls) && outfit.mediaUrls.length > 0
      ? outfit.mediaUrls.map(String)
      : Array.isArray(outfit.images)
      ? outfit.images.map(String)
      : [];
  const normalizedImages = rawImages.map((u) => normalizeMediaUrl(u)).filter(Boolean);
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
    mediaUrl: normalizeMediaUrl(outfit.mediaUrl) || normalizedImages[0] || '',
    mediaType: outfit.mediaType === 'video' ? 'video' : 'image',
    mediaUrls: normalizedImages,
    images: normalizedImages,
    videoUrl: normalizeMediaUrl(outfit.videoUrl),
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

export async function saveBookingToCloud(
  booking: RentalBooking,
  allBookings: RentalBooking[]
): Promise<void> {
  try {
    await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking),
    });
  } catch {
    // ignore if static deployment
  }

  void runFirestoreWriteSafely(async () => {
    await setDoc(doc(db, 'store_state', 'bookings'), {
      items: allBookings,
      updatedAt: Date.now(),
      writeToken: WRITE_TOKEN,
    });
  });
}

interface LiveStoreCallbacks {
  initialOutfits: LehengaOutfit[];
  initialSettings: SiteSettings;
  initialTestimonials: CustomerTestimonial[];
  initialBookings?: RentalBooking[];
  onOutfitsChange: (outfits: LehengaOutfit[]) => void;
  onSettingsChange: (settings: SiteSettings) => void;
  onTestimonialsChange: (testimonials: CustomerTestimonial[]) => void;
  onBookingsChange?: (bookings: RentalBooking[]) => void;
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
  onBookingsChange,
}: LiveStoreCallbacks): () => void {
  let isDisposed = false;
  let hasLiveBackendServer = false;
  lastEmittedOutfitsJson = JSON.stringify(initialOutfits);
  let lastEmittedSettingsJson = '';
  let lastEmittedTestimonialsJson = '';
  let lastEmittedBookingsJson = '';

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
      const [outfitsRes, settingsRes, testimonialsRes, bookingsRes] = await Promise.all([
        fetch('/api/outfits', { cache: 'no-store' }),
        fetch('/api/settings', { cache: 'no-store' }),
        fetch('/api/testimonials', { cache: 'no-store' }),
        fetch('/api/bookings', { cache: 'no-store' }),
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

      if (
        bookingsRes.ok &&
        (bookingsRes.headers.get('content-type') || '').includes('application/json')
      ) {
        hasLiveBackendServer = true;
        const serverBookings = (await bookingsRes.json()) as RentalBooking[];
        if (Array.isArray(serverBookings)) {
          const nextBookingsJson = JSON.stringify(serverBookings);
          if (nextBookingsJson !== lastEmittedBookingsJson) {
            lastEmittedBookingsJson = nextBookingsJson;
            onBookingsChange?.(serverBookings);
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

    const allDocs = Array.from(latestOutfitsMap.values()).map((item) => {
      // Guarantee that any outfit in INITIAL_OUTFITS with a videoUrl preserves its videoUrl
      const bundled = INITIAL_OUTFITS.find((b) => b.id === item.id);
      if (bundled && bundled.videoUrl && !item.videoUrl) {
        return { ...item, videoUrl: bundled.videoUrl };
      }
      return item;
    });
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
        const rawMediaUrls = Array.isArray(d.mediaUrls) && d.mediaUrls.length > 0
          ? d.mediaUrls
          : Array.isArray(d.images)
          ? d.images
          : [];
        const cleanMediaUrls = rawMediaUrls.map((u: unknown) => normalizeMediaUrl(String(u || ''))).filter(Boolean);
        nextMap.set(docSnap.id, {
          id: d.id || docSnap.id,
          code: d.color || d.code || '',
          color: d.color || d.code || '',
          title: d.title || '',
          vibeCategory: d.vibeCategory || 'Navratri Ni Pehvesh',
          pricePerDay: Number(d.pricePerDay) || 0,
          description: d.description || '',
          ogHumorTagline: d.ogHumorTagline || '',
          mediaUrl: normalizeMediaUrl(d.mediaUrl) || cleanMediaUrls[0] || '',
          mediaType: d.mediaType === 'video' ? 'video' : 'image',
          mediaUrls: cleanMediaUrls,
          images: cleanMediaUrls,
          videoUrl: normalizeMediaUrl(d.videoUrl),
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

  const unsubBookings = onSnapshot(
    doc(db, 'store_state', 'bookings'),
    (snap) => {
      if (hasLiveBackendServer || !snap.exists()) return;
      const data = snap.data();
      if (Array.isArray(data?.items)) {
        onBookingsChange?.(data.items as RentalBooking[]);
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
    unsubBookings();
  };
}
