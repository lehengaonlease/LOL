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
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { LehengaOutfit, SiteSettings, CustomerTestimonial, RentalBooking } from '../types';
import { INITIAL_OUTFITS, BUNDLED_CATALOG_UPDATED_AT } from '../data/initialOutfits';
import { getBundledCatalogImage } from '../data/bundledCatalogMedia';
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

// Always ensure network is enabled for real-time reads & synchronization
enableNetwork(db).catch(() => {});

let isWriteQuotaExhausted = false;

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
      const until = String(Date.now() + 5 * 60 * 1000);
      sessionStorage.setItem(QUOTA_EXHAUSTED_KEY, until);
    } catch {
      // ignore
    }
  }
}

async function runFirestoreWriteSafely(writeFn: () => Promise<void>): Promise<void> {
  try {
    await Promise.race([
      writeFn(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 4000)
      ),
    ]);
  } catch (err) {
    if (isQuotaError(err)) {
      tripWriteQuotaCircuitBreaker(err);
    }
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

export interface MediaMetadata {
  contentType: string;
  orientation: 'portrait' | 'landscape' | 'square';
  rotation: number;
  width: number;
  height: number;
  aspectRatio: number;
  isPortrait: boolean;
  exifOrientation?: number;
  originalName?: string;
  durationSeconds?: number;
}

/**
 * Extracts EXIF orientation tag (1-8) directly from JPEG binary ArrayBuffer.
 * Tag 1: 0° (Normal)
 * Tag 3: 180° (Upside down)
 * Tag 6: 90° CW (Typical iPhone portrait)
 * Tag 8: 270° CW / 90° CCW
 */
export function getExifOrientation(buffer: ArrayBuffer): number {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 2 || view.getUint16(0, false) !== 0xffd8) {
      return 1; // Not a JPEG
    }
    let offset = 2;
    const length = view.byteLength;
    while (offset < length) {
      if (view.getUint8(offset) !== 0xff) return 1;
      const marker = view.getUint8(offset + 1);
      if (marker === 0xe1) {
        // APP1 Marker (EXIF)
        const exifLength = view.getUint16(offset + 2, false);
        if (offset + 2 + exifLength > length) return 1;
        // Check for 'Exif\0\0'
        if (
          view.getUint32(offset + 4, false) === 0x45786966 &&
          view.getUint16(offset + 8, false) === 0x0000
        ) {
          const tiffOffset = offset + 10;
          const isLittleEndian = view.getUint16(tiffOffset, false) === 0x4949;
          const ifdOffset = view.getUint32(tiffOffset + 4, isLittleEndian);
          const numEntries = view.getUint16(tiffOffset + ifdOffset, isLittleEndian);
          for (let i = 0; i < numEntries; i++) {
            const entryOffset = tiffOffset + ifdOffset + 2 + i * 12;
            if (entryOffset + 12 > length) break;
            const tag = view.getUint16(entryOffset, isLittleEndian);
            if (tag === 0x0112) {
              // Orientation tag
              const orientation = view.getUint16(entryOffset + 8, isLittleEndian);
              return orientation >= 1 && orientation <= 8 ? orientation : 1;
            }
          }
        }
        break;
      } else if ((marker & 0xff00) !== 0xff00 && marker !== 0xd8 && marker !== 0xd9) {
        offset += 2 + view.getUint16(offset + 2, false);
      } else {
        offset += 2;
      }
    }
  } catch {
    // Fallback to standard
  }
  return 1;
}

/**
 * Normalizes an image File/Blob so pixels are physically rotated upright to prevent landscape-instead-of-portrait display.
 * Computes exact width, height, rotation, and orientation metadata.
 */
export async function normalizeImageOrientation(
  fileBlob: Blob,
  fileName: string
): Promise<{
  blob: Blob;
  metadata: MediaMetadata;
}> {
  try {
    const arrayBuffer = await fileBlob.arrayBuffer();
    const exifOrientation = getExifOrientation(arrayBuffer);

    // Modern browsers support createImageBitmap with imageOrientation: 'from-image'
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(fileBlob, { imageOrientation: 'from-image' });
        const width = bitmap.width;
        const height = bitmap.height;
        const isPortrait = height >= width;
        const orientation: 'portrait' | 'landscape' | 'square' =
          height > width ? 'portrait' : width > height ? 'landscape' : 'square';

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0, width, height);
          bitmap.close();

          const targetMime = 'image/webp';
          const normalizedBlob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), targetMime, 0.9);
          });

          if (normalizedBlob) {
            let rotation = 0;
            if (exifOrientation === 6) rotation = 90;
            else if (exifOrientation === 3) rotation = 180;
            else if (exifOrientation === 8) rotation = 270;

            return {
              blob: normalizedBlob,
              metadata: {
                contentType: targetMime,
                orientation,
                rotation,
                width,
                height,
                aspectRatio: width / height,
                isPortrait,
                exifOrientation,
                originalName: fileName,
              },
            };
          }
        }
      } catch {
        // Fallback to HTMLImageElement
      }
    }

    // Fallback: HTMLImageElement with EXIF rotation transforms
    const img = new Image();
    const objectUrl = URL.createObjectURL(fileBlob);
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image for rotation'));
      img.src = objectUrl;
    });

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    let rotation = 0;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Handle EXIF orientation angles
    if (exifOrientation === 6 || exifOrientation === 8) {
      // 90 or 270 deg: Swap width and height so result is portrait
      canvas.width = height;
      canvas.height = width;
      rotation = exifOrientation === 6 ? 90 : 270;
    } else if (exifOrientation === 3) {
      // 180 deg
      canvas.width = width;
      canvas.height = height;
      rotation = 180;
    } else {
      canvas.width = width;
      canvas.height = height;
    }

    if (ctx) {
      ctx.save();
      if (exifOrientation === 6) {
        ctx.translate(canvas.width, 0);
        ctx.rotate((90 * Math.PI) / 180);
      } else if (exifOrientation === 8) {
        ctx.translate(0, canvas.height);
        ctx.rotate((270 * Math.PI) / 180);
      } else if (exifOrientation === 3) {
        ctx.translate(canvas.width, canvas.height);
        ctx.rotate((180 * Math.PI) / 180);
      }
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }

    URL.revokeObjectURL(objectUrl);

    const targetMime = 'image/webp';
    const normalizedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), targetMime, 0.9);
    });

    const finalWidth = canvas.width;
    const finalHeight = canvas.height;
    const isPortrait = finalHeight >= finalWidth;

    return {
      blob: normalizedBlob || fileBlob,
      metadata: {
        contentType: targetMime,
        orientation: finalHeight > finalWidth ? 'portrait' : finalWidth > finalHeight ? 'landscape' : 'square',
        rotation,
        width: finalWidth,
        height: finalHeight,
        aspectRatio: finalWidth / finalHeight,
        isPortrait,
        exifOrientation,
        originalName: fileName,
      },
    };
  } catch (err) {
    return {
      blob: fileBlob,
      metadata: {
        contentType: fileBlob.type || 'image/jpeg',
        orientation: 'portrait',
        rotation: 0,
        width: 1080,
        height: 1920,
        aspectRatio: 1080 / 1920,
        isPortrait: true,
        originalName: fileName,
      },
    };
  }
}

/**
 * Inspects video dimensions and metadata (orientation, width, height, duration)
 */
export async function extractVideoMetadata(videoBlob: Blob, fileName: string): Promise<MediaMetadata> {
  return new Promise((resolve) => {
    let resolved = false;
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const objUrl = URL.createObjectURL(videoBlob);
      video.src = objUrl;

      const cleanup = () => {
        try {
          URL.revokeObjectURL(objUrl);
        } catch {
          // ignore
        }
      };

      const timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve({
          contentType: videoBlob.type || 'video/mp4',
          orientation: 'portrait',
          rotation: 0,
          width: 720,
          height: 1280,
          aspectRatio: 720 / 1280,
          isPortrait: true,
          originalName: fileName,
        });
      }, 1500);

      video.onloadedmetadata = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        const width = video.videoWidth || 720;
        const height = video.videoHeight || 1280;
        const durationSeconds = Math.round(video.duration || 0);
        const isPortrait = height >= width;
        cleanup();
        resolve({
          contentType: videoBlob.type || 'video/mp4',
          orientation: isPortrait ? 'portrait' : 'landscape',
          rotation: 0,
          width,
          height,
          aspectRatio: width / height,
          isPortrait,
          durationSeconds,
          originalName: fileName,
        });
      };

      video.onerror = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        cleanup();
        resolve({
          contentType: videoBlob.type || 'video/mp4',
          orientation: 'portrait',
          rotation: 0,
          width: 720,
          height: 1280,
          aspectRatio: 720 / 1280,
          isPortrait: true,
          originalName: fileName,
        });
      };
    } catch {
      if (resolved) return;
      resolved = true;
      resolve({
        contentType: videoBlob.type || 'video/mp4',
        orientation: 'portrait',
        rotation: 0,
        width: 720,
        height: 1280,
        aspectRatio: 720 / 1280,
        isPortrait: true,
        originalName: fileName,
      });
    }
  });
}

/**
 * Uploads a raw JavaScript File/Blob directly to Firebase Storage bucket or server
 * ensuring EXIF orientation/rotation metadata is inspected and normalized first.
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
    const isVideo = lowerType.startsWith('video/') || lowerName.endsWith('.mp4') || lowerName.endsWith('.mov');
    const isHeicFile =
      lowerType.includes('heic') ||
      lowerType.includes('heif') ||
      lowerName.endsWith('.heic') ||
      lowerName.endsWith('.heif');

    onProgress?.(0, Math.max(1, file.size));

    // 1. Convert raw HEIC/HEIF Blob to standard JPEG Blob if needed
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
        // Continue with raw blob
      }
    }

    // 2. Extract EXIF orientation and normalize pixel matrix so images stay upright in portrait
    let mediaMeta: MediaMetadata;
    if (!isVideo) {
      const normalized = await normalizeImageOrientation(uploadBlob, safeFileName);
      uploadBlob = normalized.blob;
      mediaMeta = normalized.metadata;
      contentType = mediaMeta.contentType || 'image/webp';
      if (!safeFileName.endsWith('.webp') && !safeFileName.endsWith('.jpg') && !safeFileName.endsWith('.png')) {
        safeFileName = `${safeFileName}.webp`;
      }
    } else {
      mediaMeta = await extractVideoMetadata(uploadBlob, safeFileName);
      contentType = mediaMeta.contentType || 'video/mp4';
    }

    const sanitizedPrefix = prefix.replace(/[^a-zA-Z0-9/_-]/g, '') || 'lehengas';

    // 3. Primary: Stream binary directly to the live server (/api/upload-binary or /api/upload-binary-chunk)
    const binaryServerUrl = await uploadRawBinaryToServer(
      uploadBlob,
      sanitizedPrefix,
      safeFileName,
      contentType,
      onProgress
    );
    if (binaryServerUrl) {
      // Also persist to cloud Firestore media_assets asynchronously so Vercel & shared links have it
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          const base64 = res ? (res.includes(',') ? res.split(',')[1] : res) : '';
          if (base64 && base64.length <= 1_200_000) {
            void runFirestoreWriteSafely(async () => {
              await setDoc(doc(db, 'media_assets', safeFileName), {
                mimeType: contentType,
                data: base64,
                totalChunks: 1,
                metadata: {
                  orientation: mediaMeta.orientation,
                  rotation: mediaMeta.rotation,
                  width: mediaMeta.width,
                  height: mediaMeta.height,
                  isPortrait: mediaMeta.isPortrait,
                },
                createdAt: Date.now(),
                writeToken: WRITE_TOKEN,
              });
            });
          }
        };
        reader.readAsDataURL(uploadBlob);
      } catch {
        // ignore
      }
      return binaryServerUrl;
    }

    // 4. Fallback for serverless/static environments: Try Firebase Storage with 4s timeout
    if (!isStorageBucketUnavailable && firebaseConfig.storageBucket) {
      try {
        const storagePath = `${sanitizedPrefix}/${Date.now()}_${safeFileName}`;
        const storageRef = ref(storage, storagePath);
        const customMetadata: Record<string, string> = {
          orientation: mediaMeta.orientation,
          rotation: String(mediaMeta.rotation),
          width: String(mediaMeta.width),
          height: String(mediaMeta.height),
          isPortrait: String(mediaMeta.isPortrait),
          originalName: safeFileName,
          uploadedAt: new Date().toISOString(),
        };

        const uploadTask = uploadBytesResumable(storageRef, uploadBlob, {
          contentType,
          customMetadata,
        });

        await Promise.race([
          new Promise<void>((resolve, reject) => {
            uploadTask.on(
              'state_changed',
              (snapshot) => {
                if (snapshot.totalBytes > 0) {
                  onProgress?.(snapshot.bytesTransferred, snapshot.totalBytes);
                }
              },
              (error) => {
                reject(error);
              },
              () => {
                resolve();
              }
            );
          }),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Storage upload timeout')), 4000)
          ),
        ]);

        const downloadUrl = await getDownloadURL(storageRef);
        if (downloadUrl) {
          return downloadUrl;
        }
      } catch {
        isStorageBucketUnavailable = true;
      }
    }

    // 5. Fallback 2: Standalone cloud upload (for Vercel / serverless deployments without local Express storage)
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        resolve(res ? (res.includes(',') ? res.split(',')[1] : res) : '');
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(uploadBlob);
    });

    if (base64Data) {
      const cloudMediaUrl = `/uploads/${safeFileName}`;
      // Fast single-document write for standard photos (<850KB binary -> ~1.1MB base64)
      if (base64Data.length <= 1_150_000) {
        await runFirestoreWriteSafely(async () => {
          await setDoc(doc(db, 'media_assets', safeFileName), {
            mimeType: contentType,
            data: base64Data,
            totalChunks: 1,
            metadata: {
              orientation: mediaMeta.orientation,
              rotation: mediaMeta.rotation,
              width: mediaMeta.width,
              height: mediaMeta.height,
              isPortrait: mediaMeta.isPortrait,
            },
            createdAt: Date.now(),
            writeToken: WRITE_TOKEN,
          });
        });
      } else {
        const CHUNK_SIZE = 600 * 1024;
        const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
        await runFirestoreWriteSafely(async () => {
          const batch = writeBatch(db);
          for (let i = 0; i < totalChunks; i++) {
            const chunkSlice = base64Data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            batch.set(doc(db, 'media_assets', safeFileName, 'chunks', String(i).padStart(5, '0')), {
              index: i,
              data: chunkSlice,
              writeToken: WRITE_TOKEN,
            });
          }
          batch.set(doc(db, 'media_assets', safeFileName), {
            mimeType: contentType,
            totalChunks,
            metadata: {
              orientation: mediaMeta.orientation,
              rotation: mediaMeta.rotation,
              width: mediaMeta.width,
              height: mediaMeta.height,
              isPortrait: mediaMeta.isPortrait,
            },
            createdAt: Date.now(),
            writeToken: WRITE_TOKEN,
          });
          await batch.commit();
        });
      }
      return cloudMediaUrl;
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
 * by checking bundled catalog media first, then downloading and reassembling from Firestore `media_assets`.
 */
export async function resolveCloudMediaUrl(uri: string): Promise<string> {
  if (!uri) return uri;

  // 1. Direct memory lookup from bundled catalog media
  const bundled = getBundledCatalogImage(uri);
  if (bundled) {
    return bundled;
  }

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
      const metaData = metaSnap.data() as {
        data?: string;
        mimeType?: string;
        totalChunks?: number;
      };

      // Fast-path: single document storage
      if (metaData && typeof metaData.data === 'string' && metaData.data) {
        const mimeType = metaData.mimeType || (targetId.endsWith('.mp4') ? 'video/mp4' : 'image/webp');
        const dataUrl = metaData.data.startsWith('data:') ? metaData.data : `data:${mimeType};base64,${metaData.data}`;
        resolvedMediaCache.set(cacheKey, dataUrl);
        return dataUrl;
      }

      const { mimeType = targetId.endsWith('.mp4') ? 'video/mp4' : 'image/webp' } = metaData;

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
    if (!outfitsCollectionLoaded) return;
    if (activeMutationsCount > 0) return;

    // Start with all documents from Firestore
    const firestoreDocs = Array.from(latestOutfitsMap.values());

    // Merge with INITIAL_OUTFITS: ensure bundled outfits with videos and images are always preserved
    const mergedMap = new Map<string, LehengaOutfit>();
    for (const init of INITIAL_OUTFITS) {
      mergedMap.set(init.id, { ...init });
    }
    for (const remote of firestoreDocs) {
      // Ignore junk/dummy test placeholders
      if (
        !remote.id ||
        remote.title.startsWith('New Designer Lehenga') ||
        remote.mediaUrl.includes('lehenga-orange-zardosi.jpg') ||
        remote.id === 'lol-custom-1791134547516' ||
        remote.id === 'lol-custom-1791134551908' ||
        remote.id === 'lol-custom-1791134555912' ||
        remote.id === 'lol-custom-1791134706855' ||
        remote.id === 'lol-custom-1791193889979'
      ) {
        continue;
      }
      const existing = mergedMap.get(remote.id);
      if (existing) {
        // Only override bundled outfit if remote has valid media and is newer than bundled timestamp
        const remoteUpdated = remote.updatedAt || 0;
        if (remoteUpdated > BUNDLED_CATALOG_UPDATED_AT) {
          mergedMap.set(remote.id, {
            ...existing,
            ...remote,
            videoUrl: remote.videoUrl || existing.videoUrl,
            mediaUrls: (remote.mediaUrls && remote.mediaUrls.length > 0) ? remote.mediaUrls : existing.mediaUrls,
            images: (remote.images && remote.images.length > 0) ? remote.images : existing.images,
          });
        }
      } else {
        mergedMap.set(remote.id, remote);
      }
    }

    const allDocs = Array.from(mergedMap.values());
    const validOrder = (latestOutfitOrder || []).filter(
      (id) =>
        mergedMap.has(id) &&
        !id.startsWith('lol-custom-1791134') &&
        id !== 'lol-custom-1791193889979'
    );
    if (validOrder.length > 0) {
      const orderMap = new Map<string, number>();
      validOrder.forEach((id, idx) => orderMap.set(id, idx));
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
