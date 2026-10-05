import express from 'express';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import heicConvert from 'heic-convert';
import sharp from 'sharp';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  disableNetwork,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

// Silence internal @firebase/firestore SDK logs (e.g. gRPC quota backoff)
try {
  setLogLevel('silent');
} catch {
  // ignore
}

const execFileAsync = promisify(execFile);
const serverFirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const serverDb = getFirestore(serverFirebaseApp, firebaseConfig.firestoreDatabaseId);
const FIRESTORE_WRITE_TOKEN = 'lol-sanjeevani-studio-sync-v1';

// Free tier quota protection: keep network alive for reads, handle write backoff gracefully
let isServerFirestoreQuotaExhausted = false;
let serverQuotaExhaustedUntil = 0;

function isQuotaExhaustedError(err: unknown): boolean {
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
    msg.includes("RPC 'Write'")
  );
}

function tripServerQuotaCircuitBreaker(err: unknown) {
  if (isQuotaExhaustedError(err)) {
    isServerFirestoreQuotaExhausted = true;
    serverQuotaExhaustedUntil = Date.now() + 5 * 60 * 1000;
  }
}

async function runServerFirestoreWriteSafely(writeFn: () => Promise<void>): Promise<void> {
  if (isServerFirestoreQuotaExhausted && Date.now() < serverQuotaExhaustedUntil) {
    return;
  }
  isServerFirestoreQuotaExhausted = false;
  try {
    await Promise.race([
      writeFn(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 4000)
      ),
    ]);
  } catch (err) {
    tripServerQuotaCircuitBreaker(err);
  }
}
import { INITIAL_OUTFITS } from './src/data/initialOutfits.ts';
import { INITIAL_TESTIMONIALS } from './src/data/initialTestimonials.ts';
import { DEFAULT_SITE_SETTINGS } from './src/types.ts';
import type {
  LehengaOutfit,
  RentalBooking,
  SiteSettings,
  CustomerTestimonial,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'site-settings.json');
const TESTIMONIALS_FILE = path.join(DATA_DIR, 'testimonials.json');
const MEDIA_STORE_FILE = path.join(DATA_DIR, 'media-store.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function loadMediaStore(): Record<string, string> {
  try {
    if (fs.existsSync(MEDIA_STORE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(MEDIA_STORE_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, string>;
      }
    }
  } catch (err) {
    console.error('Error reading media-store.json:', err);
  }
  return {};
}

function saveBufferToFirestoreMedia(filename: string, buf: Buffer, mimeType?: string): void {
  setImmediate(() => {
    void runServerFirestoreWriteSafely(async () => {
      const safeId = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const resolvedMime =
        mimeType ||
        (safeId.endsWith('.mp4')
          ? 'video/mp4'
          : safeId.endsWith('.webm')
          ? 'video/webm'
          : safeId.endsWith('.png')
          ? 'image/png'
          : 'image/webp');

      // Fast-path for images <= 800KB: single document write
      if (buf.length <= 800 * 1024) {
        await setDoc(doc(serverDb, 'media_assets', safeId), {
          mimeType: resolvedMime,
          data: buf.toString('base64'),
          totalChunks: 1,
          createdAt: Date.now(),
          writeToken: FIRESTORE_WRITE_TOKEN,
        });
        return;
      }

      const CHUNK_SIZE = 550 * 1024; // 550KB binary -> ~733KB base64 (under 900KB rule limit)
      const totalChunks = Math.max(1, Math.ceil(buf.length / CHUNK_SIZE));
      
      const chunkPromises: Promise<void>[] = [];
      for (let idx = 0; idx < totalChunks; idx++) {
        const slice = buf.subarray(idx * CHUNK_SIZE, Math.min(buf.length, (idx + 1) * CHUNK_SIZE));
        chunkPromises.push(
          setDoc(doc(serverDb, 'media_assets', safeId, 'chunks', String(idx).padStart(5, '0')), {
            index: idx,
            data: slice.toString('base64'),
            writeToken: FIRESTORE_WRITE_TOKEN,
          }).then(() => {})
        );
      }
      await Promise.all(chunkPromises);
      await setDoc(doc(serverDb, 'media_assets', safeId), {
        mimeType: resolvedMime,
        totalChunks,
        createdAt: Date.now(),
        writeToken: FIRESTORE_WRITE_TOKEN,
      });
    });
  });
}

const inflightFirestoreDownloads = new Map<string, Promise<Buffer | null>>();

async function loadBufferFromFirestoreMedia(filename: string): Promise<Buffer | null> {
  const safeId = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const existing = inflightFirestoreDownloads.get(safeId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const metaSnap = await getDoc(doc(serverDb, 'media_assets', safeId));
      if (!metaSnap.exists()) return null;
      const data = metaSnap.data();
      if (data && typeof data.data === 'string' && data.data.length > 0) {
        return Buffer.from(data.data, 'base64');
      }

      const chunksSnap = await getDocs(
        query(collection(serverDb, 'media_assets', safeId, 'chunks'), orderBy('index', 'asc'))
      );
      if (chunksSnap.empty) return null;
      const parts: Buffer[] = [];
      chunksSnap.forEach((d) => {
        const b64 = d.data().data;
        if (typeof b64 === 'string' && b64.length > 0) {
          parts.push(Buffer.from(b64, 'base64'));
        }
      });
      return parts.length > 0 ? Buffer.concat(parts) : null;
    } catch {
      return null;
    } finally {
      inflightFirestoreDownloads.delete(safeId);
    }
  })();

  inflightFirestoreDownloads.set(safeId, promise);
  return promise;
}

let mediaStoreWriteTimer: NodeJS.Timeout | null = null;
const pendingMediaStoreUpdates: Record<string, string> = {};

function saveToMediaStore(filename: string, buf: Buffer) {
  try {
    // Persist in Firestore media_assets asynchronously so ais-dev and ais-pre share all uploaded photos & videos
    saveBufferToFirestoreMedia(filename, buf);
    // Only persist files <= 6MB in media-store.json
    if (buf.length > 6_500_000) return;
    pendingMediaStoreUpdates[filename] = buf.toString('base64');
    if (!mediaStoreWriteTimer) {
      mediaStoreWriteTimer = setTimeout(() => {
        mediaStoreWriteTimer = null;
        try {
          const store = loadMediaStore();
          Object.assign(store, pendingMediaStoreUpdates);
          fs.writeFileSync(MEDIA_STORE_FILE, JSON.stringify(store), 'utf-8');
        } catch (err) {
          console.error('Error writing media-store.json:', err);
        }
      }, 500);
    }
  } catch (err) {
    console.error('Error in saveToMediaStore:', err);
  }
}

function restoreMissingUploadsFromMediaStore() {
  try {
    const store = loadMediaStore();
    for (const [filename, b64] of Object.entries(store)) {
      const targetPath = path.join(UPLOADS_DIR, filename);
      if (!fs.existsSync(targetPath) && typeof b64 === 'string' && b64.length > 0) {
        fs.writeFileSync(targetPath, Buffer.from(b64, 'base64'));
      }
    }
  } catch (err) {
    console.error('Error restoring uploads from media-store.json:', err);
  }
}

restoreMissingUploadsFromMediaStore();

function loadSiteSettings(): SiteSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SITE_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.error('Error reading site-settings.json:', err);
  }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SITE_SETTINGS, null, 2), 'utf-8');
  return { ...DEFAULT_SITE_SETTINGS };
}

function saveSiteSettings(settings: SiteSettings): SiteSettings {
  const merged = { ...DEFAULT_SITE_SETTINGS, ...settings };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

function loadTestimonials(): CustomerTestimonial[] {
  try {
    if (fs.existsSync(TESTIMONIALS_FILE)) {
      const raw = fs.readFileSync(TESTIMONIALS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading testimonials.json:', err);
  }
  fs.writeFileSync(TESTIMONIALS_FILE, JSON.stringify(INITIAL_TESTIMONIALS, null, 2), 'utf-8');
  return [...INITIAL_TESTIMONIALS];
}

function saveTestimonials(list: CustomerTestimonial[]) {
  // Ensure all photos are saved to permanent public files and media store
  const sanitized = list.map((item) => {
    let photoUrl = String(item.photoUrl || '');
    if (photoUrl.startsWith('data:')) {
      photoUrl = saveBase64MediaToPublic(photoUrl, 'client-review');
    }
    return { ...item, photoUrl };
  });

  fs.writeFileSync(TESTIMONIALS_FILE, JSON.stringify(sanitized, null, 2), 'utf-8');
  try {
    const initialTestimonialsFile = path.join(__dirname, 'src', 'data', 'initialTestimonials.ts');
    const tsContent = `import { CustomerTestimonial } from '../types';\n\nexport const INITIAL_TESTIMONIALS: CustomerTestimonial[] = ${JSON.stringify(sanitized, null, 2)};\n`;
    fs.writeFileSync(initialTestimonialsFile, tsContent, 'utf-8');
  } catch (err) {
    console.error('Error syncing initialTestimonials.ts:', err);
  }
}

function loadOutfits(): LehengaOutfit[] {
  try {
    if (fs.existsSync(CATALOG_FILE)) {
      const raw = fs.readFileSync(CATALOG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading catalog.json, falling back to INITIAL_OUTFITS:', err);
  }
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(INITIAL_OUTFITS, null, 2), 'utf-8');
  return [...INITIAL_OUTFITS];
}

function saveOutfits(outfits: LehengaOutfit[]) {
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(outfits, null, 2), 'utf-8');
  try {
    const initialOutfitsFile = path.join(__dirname, 'src', 'data', 'initialOutfits.ts');
    const tsContent = `import { LehengaOutfit } from '../types';\n\nexport const BUNDLED_CATALOG_UPDATED_AT = ${Date.now()};\n\nexport const INITIAL_OUTFITS: LehengaOutfit[] = ${JSON.stringify(outfits, null, 2)};\n`;
    fs.writeFileSync(initialOutfitsFile, tsContent, 'utf-8');
  } catch (err) {
    console.error('Error syncing initialOutfits.ts:', err);
  }
  // Prune unreferenced lehenga-* uploads from media-store.json and public/uploads
  try {
    const referenced = new Set<string>();
    for (const o of outfits) {
      if (o.mediaUrl && o.mediaUrl.startsWith('/uploads/')) {
        referenced.add(o.mediaUrl.replace('/uploads/', ''));
      }
      if (o.videoUrl && o.videoUrl.startsWith('/uploads/')) {
        referenced.add(o.videoUrl.replace('/uploads/', ''));
      }
      if (Array.isArray(o.images)) {
        for (const img of o.images) {
          if (typeof img === 'string' && img.startsWith('/uploads/')) {
            referenced.add(img.replace('/uploads/', ''));
          }
        }
      }
    }
    const store = loadMediaStore();
    let storeModified = false;
    for (const key of Object.keys(store)) {
      if (key.startsWith('lehenga-') && !referenced.has(key)) {
        delete store[key];
        storeModified = true;
      }
    }
    if (storeModified) {
      fs.writeFileSync(MEDIA_STORE_FILE, JSON.stringify(store), 'utf-8');
    }
  } catch {
    // ignore cleanup errors
  }
}

function loadBookings(): RentalBooking[] {
  try {
    if (fs.existsSync(BOOKINGS_FILE)) {
      const raw = fs.readFileSync(BOOKINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading bookings.json:', err);
  }
  const initialBookings: RentalBooking[] = [
    {
      id: 'bk-demo-1',
      outfitId: 'lol-ind-01',
      outfitCode: 'LOL-IND-01',
      outfitTitle: "The 'Bua-Ji Distractor' Burnt Tangerine Zardosi",
      pricePerDay: 2499,
      rentalDate: '2026-10-04',
      returnDate: '2026-10-05',
      pickupTime: '01:00 PM - Afternoon Slay',
      customerName: 'Aashna Jain (Vijay Nagar)',
      customerPhone: '+91 70008 61465',
      promisedNextDayReturn: true,
      createdAt: '2026-09-26T06:30:00.000Z',
      syncedToGoogleTasks: false,
    },
  ];
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(initialBookings, null, 2), 'utf-8');
  return initialBookings;
}

function saveBookings(bookings: RentalBooking[]) {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), 'utf-8');
  if (isServerFirestoreQuotaExhausted) return;
  void runServerFirestoreWriteSafely(async () => {
    await setDoc(doc(serverDb, 'store_state', 'bookings'), {
      items: bookings,
      updatedAt: Date.now(),
      writeToken: FIRESTORE_WRITE_TOKEN,
    });
  });
}

function isValidAdminPassword(pw?: string): boolean {
  if (!pw) return false;
  const normalized = pw.trim().toLowerCase();
  return (
    normalized === 'sanjeevani' ||
    normalized === 'lolindore' ||
    normalized === 'lol2026' ||
    pw.trim() === process.env.ADMIN_PASSWORD
  );
}

function saveBase64MediaToPublic(dataUrl: string, prefix = 'outfit'): string {
  const matches = dataUrl.match(/^data:([A-Za-z0-9-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return dataUrl;
  }
  const mimeType = matches[1];
  const base64Data = matches[2];
  let ext = 'jpg';
  if (mimeType.includes('png')) ext = 'png';
  else if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('gif')) ext = 'gif';
  else if (mimeType.includes('mp4')) ext = 'mp4';
  else if (mimeType.includes('webm')) ext = 'webm';
  else if (mimeType.includes('quicktime') || mimeType.includes('mov')) ext = 'mov';

  const buffer = Buffer.from(base64Data, 'base64');
  const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/${filename}`;
}

async function processAndSaveImageBuffer(rawBuf: Buffer, targetWebpPath: string): Promise<void> {
  try {
    let inputBuf = rawBuf;
    const header = rawBuf.subarray(4, 12).toString('ascii');
    if (
      header.includes('ftypheic') ||
      header.includes('ftypmif1') ||
      header.includes('ftypheix') ||
      header.includes('ftyphevc')
    ) {
      try {
        const jpegBuf = await heicConvert({
          buffer: rawBuf,
          format: 'JPEG',
          quality: 0.95,
        });
        inputBuf = Buffer.from(jpegBuf);
      } catch {
        // sharp may handle directly
      }
    }

    // sharp().rotate() with NO args reads EXIF Orientation tag (1-8) and automatically rotates pixels to upright portrait!
    await sharp(inputBuf)
      .rotate()
      .resize({
        width: 1400,
        height: 2200,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toFile(targetWebpPath);
  } catch (err) {
    // Fallback: write buffer directly or use ffmpeg with autorotate
    try {
      const tempIn = `${targetWebpPath}.tmp.in`;
      fs.writeFileSync(tempIn, rawBuf);
      await execFileAsync('ffmpeg', [
        '-y',
        '-autorotate',
        '-i',
        tempIn,
        '-vf',
        "scale='min(1200,iw)':-2",
        '-q:v',
        '82',
        targetWebpPath,
      ]);
      if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
    } catch {
      fs.writeFileSync(targetWebpPath, rawBuf);
    }
  }
}

async function ensureBrowserCompatibleVideo(filePath: string): Promise<void> {
  if (!filePath.endsWith('.mp4') && !filePath.endsWith('.mov')) return;
  try {
    const stat = fs.statSync(filePath);
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=codec_name,pix_fmt',
      '-of',
      'default=noprint_wrappers=1',
      filePath,
    ]);
    const isH264 = stdout.includes('codec_name=h264');
    const isYuv420p = stdout.includes('pix_fmt=yuv420p') && !stdout.includes('yuv420p10');
    if (isH264 && isYuv420p && stat.size <= 4_500_000) return;

    const tempOut = `${filePath}.h264.mp4`;
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      filePath,
      '-vf',
      "scale='min(720,iw)':-2,format=yuv420p",
      '-c:v',
      'libx264',
      '-profile:v',
      'main',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'veryfast',
      '-threads',
      '0',
      '-crf',
      '30',
      '-maxrate',
      '1200k',
      '-bufsize',
      '2400k',
      '-movflags',
      '+faststart',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      tempOut,
    ]);
    if (fs.existsSync(tempOut) && fs.statSync(tempOut).size > 1000) {
      fs.renameSync(tempOut, filePath);
    }
  } catch (err) {
    console.warn('Video transcode skipped:', err);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function injectDynamicOgTags(html: string, outfit: LehengaOutfit, baseUrl: string): string {
  const ogTitle = `${outfit.title} (₹${outfit.pricePerDay.toLocaleString('en-IN')}/day) | LOL: Lehenga On Lease`;
  const ogDescription = `${outfit.ogHumorTagline || outfit.description} • Code: ${outfit.code} • Rent in Indore by Sanjeevani.`;
  const fullMediaUrl = outfit.mediaUrl.startsWith('http')
    ? outfit.mediaUrl
    : `${baseUrl}${outfit.mediaUrl.startsWith('/') ? '' : '/'}${outfit.mediaUrl}`;
  const shareUrl = `${baseUrl}/outfit/${encodeURIComponent(outfit.id)}`;

  return html
    .replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(ogTitle)}</title>`)
    .replace(
      /<meta name="description" content=".*?"\s*\/?>/i,
      `<meta name="description" content="${escapeHtml(ogDescription)}" />`
    )
    .replace(
      /<meta property="og:title" content=".*?"\s*\/?>/i,
      `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`
    )
    .replace(
      /<meta property="og:description" content=".*?"\s*\/?>/i,
      `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`
    )
    .replace(
      /<meta property="og:image" content=".*?"\s*\/?>/i,
      `<meta property="og:image" content="${escapeHtml(fullMediaUrl)}" />\n    <meta property="og:url" content="${escapeHtml(shareUrl)}" />`
    )
    .replace(
      /<meta name="twitter:title" content=".*?"\s*\/?>/i,
      `<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />`
    )
    .replace(
      /<meta name="twitter:description" content=".*?"\s*\/?>/i,
      `<meta name="twitter:description" content="${escapeHtml(ogDescription)}" />`
    )
    .replace(
      /<meta name="twitter:image" content=".*?"\s*\/?>/i,
      `<meta name="twitter:image" content="${escapeHtml(fullMediaUrl)}" />`
    );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(
    '/uploads',
    async (req, _res, next) => {
      const requestedFile = path.basename(req.path);
      const diskPath = path.join(UPLOADS_DIR, requestedFile);
      if (requestedFile && !fs.existsSync(diskPath)) {
        const store = loadMediaStore();
        if (store[requestedFile]) {
          try {
            fs.writeFileSync(diskPath, Buffer.from(store[requestedFile], 'base64'));
          } catch {
            // ignore
          }
        } else {
          const cloudBuf = await loadBufferFromFirestoreMedia(requestedFile);
          if (cloudBuf && cloudBuf.length > 0) {
            try {
              fs.writeFileSync(diskPath, cloudBuf);
            } catch {
              // ignore
            }
          }
        }
      }
      next();
    },
    express.static(UPLOADS_DIR, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.mp4') || filePath.endsWith('.webm')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Accept-Ranges', 'bytes');
        }
      },
    }),
    (_req, res) => {
      res.status(404).end();
    }
  );
  app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

  // API: Upload custom hero banner video (.mp4 / .webm)
  app.post('/api/banner-video', (req, res) => {
    try {
      const { videoDataUrl } = req.body;
      if (!videoDataUrl || typeof videoDataUrl !== 'string') {
        res.status(400).json({ error: 'Missing videoDataUrl' });
        return;
      }
      const matches = videoDataUrl.match(/^data:([A-Za-z0-9-+/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        res.status(400).json({ error: 'Invalid base64 video data' });
        return;
      }
      const buffer = Buffer.from(matches[2], 'base64');
      const filePath = path.join(UPLOADS_DIR, 'hero-banner.mp4');
      fs.writeFileSync(filePath, buffer);
      fs.writeFileSync(path.join(__dirname, 'public', 'hero-banner.mp4'), buffer);
      const newUrl = '/hero-banner.mp4';
      const currentSettings = loadSiteSettings();
      saveSiteSettings({ ...currentSettings, heroVideoUrl: newUrl, heroMediaType: 'video' });
      res.json({ ok: true, url: newUrl });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Upload failed' });
    }
  });

  // API: Generic Media Upload (Logo, Banner Image/Video, Lehenga Angles)
  app.post('/api/upload-media', async (req, res) => {
    try {
      const { dataUrl, prefix } = req.body;
      if (!dataUrl || typeof dataUrl !== 'string') {
        res.status(400).json({ error: 'Missing dataUrl' });
        return;
      }
      let finalDataUrl = dataUrl;
      const matches = dataUrl.match(/^data:([A-Za-z0-9-+/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const rawBuf = Buffer.from(matches[2], 'base64');
        const header = rawBuf.subarray(4, 12).toString('ascii');
        if (
          matches[1].includes('heic') ||
          matches[1].includes('heif') ||
          header.includes('ftypheic') ||
          header.includes('ftypmif1') ||
          header.includes('ftypheix') ||
          header.includes('ftyphevc')
        ) {
          const jpegBuf = await heicConvert({
            buffer: rawBuf,
            format: 'JPEG',
            quality: 0.9,
          });
          finalDataUrl = `data:image/jpeg;base64,${Buffer.from(jpegBuf).toString('base64')}`;
        }
      }
      const savedUrl = saveBase64MediaToPublic(finalDataUrl, prefix || 'media');
      const savedDiskPath = path.join(__dirname, 'public', savedUrl.replace(/^\/+/, ''));
      const savedFilename = path.basename(savedDiskPath);
      if (savedUrl.endsWith('.mp4') || savedUrl.endsWith('.mov')) {
        await ensureBrowserCompatibleVideo(savedDiskPath);
        if (fs.existsSync(savedDiskPath)) {
          saveToMediaStore(savedFilename, fs.readFileSync(savedDiskPath));
        }
        res.json({ ok: true, url: savedUrl });
        return;
      }
      // For images, compress to crisp WebP file on disk, back up in media-store.json, and return clean /uploads/... URL
      try {
        const webpFilename = savedFilename.replace(/\.[^.]+$/, '') + '.webp';
        const webpPath = path.join(UPLOADS_DIR, webpFilename);
        await execFileAsync('ffmpeg', [
          '-y',
          '-i',
          savedDiskPath,
          '-vf',
          "scale='min(1200,iw)':-2",
          '-q:v',
          '80',
          webpPath,
        ]);
        if (fs.existsSync(webpPath)) {
          if (webpPath !== savedDiskPath && fs.existsSync(savedDiskPath)) {
            try {
              fs.unlinkSync(savedDiskPath);
            } catch {
              // ignore
            }
          }
          saveToMediaStore(webpFilename, fs.readFileSync(webpPath));
          res.json({ ok: true, url: `/uploads/${webpFilename}` });
          return;
        }
      } catch {
        // fallback
      }
      if (fs.existsSync(savedDiskPath)) {
        saveToMediaStore(savedFilename, fs.readFileSync(savedDiskPath));
      }
      res.json({ ok: true, url: savedUrl });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Upload failed' });
    }
  });

  // API: Chunked Media Upload for large videos (.mp4 / .mov / .webm) and high-res photos
  app.post('/api/upload-chunk', (req, res) => {
    try {
      const { uploadId, chunkIndex, chunkBase64 } = req.body;
      if (!uploadId || typeof chunkBase64 !== 'string') {
        res.status(400).json({ error: 'Missing uploadId or chunkBase64' });
        return;
      }
      const safeId = String(uploadId).replace(/[^a-zA-Z0-9_-]/g, '');
      const tempPath = path.join(UPLOADS_DIR, `.tmp-${safeId}.part`);
      const buf = Buffer.from(chunkBase64, 'base64');
      if (Number(chunkIndex) === 0 && fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      fs.appendFileSync(tempPath, buf);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Chunk upload failed' });
    }
  });

  app.post('/api/upload-finalize', async (req, res) => {
    try {
      const { uploadId, prefix, mimeType, fileName } = req.body;
      if (!uploadId) {
        res.status(400).json({ error: 'Missing uploadId' });
        return;
      }
      const safeId = String(uploadId).replace(/[^a-zA-Z0-9_-]/g, '');
      const tempPath = path.join(UPLOADS_DIR, `.tmp-${safeId}.part`);
      if (!fs.existsSync(tempPath)) {
        res.status(404).json({ error: 'Upload temp file not found' });
        return;
      }

      let rawBuf = fs.readFileSync(tempPath);
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // ignore
      }

      const mime = String(mimeType || '').toLowerCase();
      const lowerName = String(fileName || '').toLowerCase();
      const header = rawBuf.subarray(4, 12).toString('ascii');

      let ext = 'jpg';
      if (
        mime.includes('heic') ||
        mime.includes('heif') ||
        lowerName.endsWith('.heic') ||
        lowerName.endsWith('.heif') ||
        header.includes('ftypheic') ||
        header.includes('ftypmif1') ||
        header.includes('ftypheix') ||
        header.includes('ftyphevc')
      ) {
        const jpegBuf = await heicConvert({
          buffer: rawBuf,
          format: 'JPEG',
          quality: 0.9,
        });
        rawBuf = Buffer.from(jpegBuf);
        ext = 'jpg';
      } else if (mime.includes('png') || lowerName.endsWith('.png')) {
        ext = 'png';
      } else if (mime.includes('webp') || lowerName.endsWith('.webp')) {
        ext = 'webp';
      } else if (mime.includes('gif') || lowerName.endsWith('.gif')) {
        ext = 'gif';
      } else if (mime.includes('webm') || lowerName.endsWith('.webm')) {
        ext = 'webm';
      } else if (
        mime.includes('mp4') ||
        mime.includes('quicktime') ||
        mime.includes('mov') ||
         mime.includes('video') ||
        lowerName.endsWith('.mp4') ||
        lowerName.endsWith('.mov')
      ) {
        // Save .mov / .mp4 with .mp4 extension so HTML5 <video> plays it smoothly
        ext = 'mp4';
      }

      const safePrefix = String(prefix || 'media').replace(/[^a-zA-Z0-9_-]/g, '');
      const finalName = `${safePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const finalPath = path.join(UPLOADS_DIR, finalName);
      fs.writeFileSync(finalPath, rawBuf);
      if (ext === 'mp4') {
        await ensureBrowserCompatibleVideo(finalPath);
        if (fs.existsSync(finalPath)) {
          saveToMediaStore(finalName, fs.readFileSync(finalPath));
        }
        res.json({ ok: true, url: `/uploads/${finalName}` });
        return;
      }

      // For images (including converted HEIC), convert to compact WebP file on disk and return clean /uploads/... URL
      try {
        const webpName = finalName.replace(/\.[^.]+$/, '') + '.webp';
        const webpPath = path.join(UPLOADS_DIR, webpName);
        await execFileAsync('ffmpeg', [
          '-y',
          '-i',
          finalPath,
          '-vf',
          "scale='min(1200,iw)':-2",
          '-q:v',
          '80',
          webpPath,
        ]);
        if (fs.existsSync(webpPath)) {
          if (webpPath !== finalPath && fs.existsSync(finalPath)) {
            try {
              fs.unlinkSync(finalPath);
            } catch {
              // ignore
            }
          }
          saveToMediaStore(webpName, fs.readFileSync(webpPath));
          res.json({ ok: true, url: `/uploads/${webpName}` });
          return;
        }
      } catch {
        // fallback
      }

      saveToMediaStore(finalName, rawBuf);
      res.json({ ok: true, url: `/uploads/${finalName}` });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Finalize failed' });
    }
  });

  // API: Raw Binary Chunk Upload (Zero Base64, supports 200MB+ videos without hitting Cloud Run 32MB proxy limit)
  app.post(
    '/api/upload-binary-chunk',
    express.raw({ type: '*/*', limit: '20mb' }),
    (req, res) => {
      try {
        const uploadId = String(req.headers['x-upload-id'] || '').replace(/[^a-zA-Z0-9_-]/g, '');
        const chunkIndex = Number(req.headers['x-chunk-index'] || '0');
        const rawBuf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
        if (!uploadId || rawBuf.length === 0) {
          res.status(400).json({ error: 'Missing uploadId or binary chunk' });
          return;
        }
        const tempPath = path.join(UPLOADS_DIR, `.tmp-${uploadId}.part`);
        if (chunkIndex === 0 && fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        fs.appendFileSync(tempPath, rawBuf);
        res.json({ ok: true });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Binary chunk failed' });
      }
    }
  );

  app.post('/api/upload-binary-finalize', async (req, res) => {
    try {
      const { uploadId, prefix, mimeType, fileName } = req.body;
      const safeId = String(uploadId || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const tempPath = path.join(UPLOADS_DIR, `.tmp-${safeId}.part`);
      if (!safeId || !fs.existsSync(tempPath)) {
        res.status(404).json({ error: 'Upload temp file not found' });
        return;
      }

      const rawPrefix = String(prefix || 'lehengas').replace(/[^a-zA-Z0-9_-]/g, '');
      const cleanOriginal = String(fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
      const mime = String(mimeType || '').toLowerCase();
      const lowerName = cleanOriginal.toLowerCase();

      const fd = fs.openSync(tempPath, 'r');
      const headerBuf = Buffer.alloc(16);
      fs.readSync(fd, headerBuf, 0, 16, 0);
      fs.closeSync(fd);
      const header = headerBuf.subarray(4, 12).toString('ascii');

      const isHeic =
        mime.includes('heic') ||
        mime.includes('heif') ||
        lowerName.endsWith('.heic') ||
        lowerName.endsWith('.heif') ||
        header.includes('ftypheic') ||
        header.includes('ftypmif1') ||
        header.includes('ftypheix');

      const isVideo =
        !isHeic &&
        (mime.startsWith('video/') ||
          mime.includes('mp4') ||
          mime.includes('quicktime') ||
          /\.(mp4|mov|webm|m4v)$/i.test(lowerName));

      const ext = isVideo ? 'mp4' : 'webp';
      const baseStem = cleanOriginal.replace(/\.[^.]+$/, '').slice(0, 32) || 'media';
      const finalName = `${rawPrefix}-${Date.now()}_${baseStem}.${ext}`;
      const finalPath = path.join(UPLOADS_DIR, finalName);

      if (isVideo) {
        fs.renameSync(tempPath, finalPath);
        void ensureBrowserCompatibleVideo(finalPath);
        if (fs.existsSync(finalPath)) {
          const finalBuf = fs.readFileSync(finalPath);
          saveToMediaStore(finalName, finalBuf);
        }
        res.json({ ok: true, url: `/uploads/${finalName}` });
        return;
      }

      // Process image with sharp: auto-rotates EXIF orientation to true portrait and saves crisp WebP
      const rawBuf = fs.readFileSync(tempPath);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      await processAndSaveImageBuffer(rawBuf, finalPath);

      if (fs.existsSync(finalPath)) {
        const finalBuf = fs.readFileSync(finalPath);
        saveToMediaStore(finalName, finalBuf);
      }
      res.json({ ok: true, url: `/uploads/${finalName}` });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Binary finalize failed' });
    }
  });

  // API: Direct Raw Binary Stream Upload (Zero FileReader / Base64 overhead, Auto EXIF Portrait Rotation)
  app.post(
    '/api/upload-binary',
    express.raw({ type: '*/*', limit: '250mb' }),
    async (req, res) => {
      try {
        let rawBuf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
        if (!rawBuf || rawBuf.length === 0) {
          res.status(400).json({ error: 'Empty binary body' });
          return;
        }
        const rawPrefix = String(req.headers['x-prefix'] || 'lehengas').replace(
          /[^a-zA-Z0-9_-]/g,
          ''
        );
        const rawFileName = decodeURIComponent(String(req.headers['x-file-name'] || 'file'));
        const cleanOriginal = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const mime = String(req.headers['content-type'] || '').toLowerCase();
        const lowerName = cleanOriginal.toLowerCase();
        const header = rawBuf.subarray(4, 12).toString('ascii');

        const isHeic =
          mime.includes('heic') ||
          mime.includes('heif') ||
          lowerName.endsWith('.heic') ||
          lowerName.endsWith('.heif') ||
          header.includes('ftypheic') ||
          header.includes('ftypmif1') ||
          header.includes('ftypheix');

        const isVideo =
          !isHeic &&
          (mime.startsWith('video/') ||
            mime.includes('mp4') ||
            mime.includes('quicktime') ||
            /\.(mp4|mov|webm|m4v)$/i.test(lowerName));

        const ext = isVideo ? 'mp4' : 'webp';
        const baseStem = cleanOriginal.replace(/\.[^.]+$/, '').slice(0, 32) || 'media';
        const finalName = `${rawPrefix}-${Date.now()}_${baseStem}.${ext}`;
        const finalPath = path.join(UPLOADS_DIR, finalName);

        if (isVideo) {
          fs.writeFileSync(finalPath, rawBuf);
          void ensureBrowserCompatibleVideo(finalPath);
          if (fs.existsSync(finalPath)) {
            saveToMediaStore(finalName, fs.readFileSync(finalPath));
          }
          res.json({ ok: true, url: `/uploads/${finalName}` });
          return;
        }

        // Image: auto-rotate EXIF orientation to correct portrait and save WebP via sharp
        await processAndSaveImageBuffer(rawBuf, finalPath);

        if (fs.existsSync(finalPath)) {
          saveToMediaStore(finalName, fs.readFileSync(finalPath));
        }
        res.json({ ok: true, url: `/uploads/${finalName}` });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Binary upload failed' });
      }
    }
  );

  // API: Rotate Image on disk (e.g. 90deg clockwise)
  app.post('/api/rotate-image', async (req, res) => {
    try {
      const { url, degrees } = req.body;
      if (!url || typeof url !== 'string') {
        res.status(400).json({ error: 'Missing url' });
        return;
      }
      const cleanUrl = url.replace(/^\/+/, '');
      const diskPath = path.join(__dirname, 'public', cleanUrl);
      if (!fs.existsSync(diskPath)) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }
      const rot = Number(degrees) || 90;
      const baseName = path.basename(diskPath).replace(/\.[^.]+$/, '');
      const newName = `${baseName}-r${Date.now().toString(36).slice(-4)}.webp`;
      const newPath = path.join(UPLOADS_DIR, newName);

      const buf = fs.readFileSync(diskPath);
      await sharp(buf)
        .rotate(rot)
        .webp({ quality: 85 })
        .toFile(newPath);

      const finalBuf = fs.readFileSync(newPath);
      saveToMediaStore(newName, finalBuf);
      res.json({ ok: true, url: `/uploads/${newName}` });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Rotation failed' });
    }
  });

  // API: Get & Update Site Settings (Top Logo, Bottom Logo, Hero Banner Video/Image, Brand Text)
  app.get('/api/settings', (_req, res) => {
    res.json(loadSiteSettings());
  });

  app.put('/api/settings', (req, res) => {
    try {
      const incoming = req.body as Partial<SiteSettings>;
      const current = loadSiteSettings();
      const updated: SiteSettings = {
        ...current,
        ...incoming,
      };
      if (updated.topLogoUrl && updated.topLogoUrl.startsWith('data:')) {
        updated.topLogoUrl = saveBase64MediaToPublic(updated.topLogoUrl, 'logo-top');
      }
      if (updated.bottomLogoUrl && updated.bottomLogoUrl.startsWith('data:')) {
        updated.bottomLogoUrl = saveBase64MediaToPublic(updated.bottomLogoUrl, 'logo-bottom');
      }
      if (updated.heroPosterUrl && updated.heroPosterUrl.startsWith('data:')) {
        updated.heroPosterUrl = saveBase64MediaToPublic(updated.heroPosterUrl, 'hero-poster');
      }
      if (updated.heroVideoUrl && updated.heroVideoUrl.startsWith('data:')) {
        updated.heroVideoUrl = saveBase64MediaToPublic(updated.heroVideoUrl, 'hero-video');
      }
      const saved = saveSiteSettings(updated);
      res.json(saved);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save settings' });
    }
  });

  // API: Verify Admin Password
  app.post('/api/admin/verify', (req, res) => {
    const { password } = req.body;
    if (isValidAdminPassword(password)) {
      res.json({ ok: true, message: 'Welcome back to the Vault, Sanjeevani! ✨' });
    } else {
      res.status(401).json({
        ok: false,
        error: 'Wrong secret code bestie! Hint: Try "sanjeevani" or "lolindore".',
      });
    }
  });

  // API: Get all outfits
  app.get('/api/outfits', (_req, res) => {
    const outfits = loadOutfits();
    res.json(outfits);
  });

  // API: Sync entire outfits catalog from client backup (prevents container cold-start from wiping custom listings)
  app.put('/api/outfits/sync', (req, res) => {
    const { outfits } = req.body;
    if (!Array.isArray(outfits)) {
      res.status(400).json({ error: 'Invalid outfits array' });
      return;
    }
    saveOutfits(outfits);
    res.json(outfits);
  });

  // API: Update or insert a single outfit by ID without overwriting concurrent updates to other outfits
  app.put('/api/outfits/:id', (req, res) => {
    const targetId = req.params.id;
    const incoming = req.body?.outfit as LehengaOutfit | undefined;
    if (!incoming || !targetId) {
      res.status(400).json({ error: 'Missing outfit payload' });
      return;
    }
    const current = loadOutfits();
    const idx = current.findIndex((o) => o.id === targetId);
    if (idx >= 0) {
      current[idx] = incoming;
    } else {
      current.unshift(incoming);
    }
    saveOutfits(current);
    res.json(current);
  });

  // API: Get & Create Customer Testimonials (Indore Client Reviews + 1 Photo)
  app.get('/api/testimonials', (_req, res) => {
    res.json(loadTestimonials());
  });

  app.put('/api/testimonials/sync', (req, res) => {
    try {
      const { testimonials } = req.body;
      if (!Array.isArray(testimonials)) {
        res.status(400).json({ error: 'Invalid testimonials array' });
        return;
      }
      saveTestimonials(testimonials);
      res.json(testimonials);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to sync testimonials' });
    }
  });

  app.post('/api/testimonials', (req, res) => {
    try {
      const { customerName, indoreLocation, rating, quote, photoUrl, outfitCode } = req.body;
      if (!customerName || !quote || !photoUrl) {
        res.status(400).json({ error: 'Name, quote, and 1 photo are required.' });
        return;
      }
      let savedPhotoUrl = String(photoUrl);
      if (savedPhotoUrl.startsWith('data:')) {
        savedPhotoUrl = saveBase64MediaToPublic(savedPhotoUrl, 'client-review');
      }
      const newReview: CustomerTestimonial = {
        id: `test-${Date.now()}`,
        customerName: String(customerName).trim(),
        indoreLocation: String(indoreLocation || 'Indore • Verified LOL Client').trim(),
        rating: Math.max(1, Math.min(5, Number(rating) || 5)),
        quote: String(quote).trim(),
        photoUrl: savedPhotoUrl,
        outfitCode: outfitCode ? String(outfitCode).trim() : undefined,
        createdAt: new Date().toISOString(),
      };
      const current = loadTestimonials();
      const updated = [newReview, ...current];
      saveTestimonials(updated);
      res.status(201).json(newReview);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save review' });
    }
  });

  app.delete('/api/testimonials/:id', (req, res) => {
    try {
      const current = loadTestimonials();
      const filtered = current.filter((item) => item.id !== req.params.id);
      saveTestimonials(filtered);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete review' });
    }
  });

  // API: Get single outfit OG preview data
  app.get('/api/og-preview/:id', (req, res) => {
    const outfits = loadOutfits();
    const outfit = outfits.find((o) => o.id === req.params.id || o.code === req.params.id);
    if (!outfit) {
      res.status(404).json({ error: 'Outfit not found' });
      return;
    }
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
    const baseUrl = process.env.APP_URL && !process.env.APP_URL.includes('MY_APP_URL')
      ? process.env.APP_URL.replace(/\/$/, '')
      : `${protocol}://${host}`;

    res.json({
      title: `${outfit.title} (₹${outfit.pricePerDay.toLocaleString('en-IN')}/day) | LOL: Lehenga On Lease`,
      description: `${outfit.ogHumorTagline || outfit.description} • Code: ${outfit.code}`,
      image: outfit.mediaUrl.startsWith('http') ? outfit.mediaUrl : `${baseUrl}${outfit.mediaUrl}`,
      url: `${baseUrl}/?outfit=${encodeURIComponent(outfit.id)}`,
      outfit,
    });
  });

  // API: Create a new outfit (Admin)
  app.post('/api/outfits', (req, res) => {
    const adminPassword = req.headers['x-admin-password'] as string | undefined;
    const {
      password,
      id: incomingId,
      title,
      code,
      pricePerDay,
      description,
      ogHumorTagline,
      mediaDataUrl,
      mediaUrl,
      mediaType,
      images,
      videoUrl,
      vibeCategory,
      sizes,
    } = req.body;

    if (!isValidAdminPassword(adminPassword || password)) {
      res.status(401).json({ error: 'Unauthorized: Invalid admin password.' });
      return;
    }

    if (!title || !pricePerDay) {
      res.status(400).json({ error: 'Title and Price Per Day are required.' });
      return;
    }

    const outfits = loadOutfits();

    const savedImages: string[] = Array.isArray(images)
      ? images
          .map((img: unknown) => (typeof img === 'string' ? img.trim() : ''))
          .filter(Boolean)
          .slice(0, 4)
          .map((img) =>
            img.startsWith('data:') ? saveBase64MediaToPublic(img, 'lehenga-img') : img
          )
      : [];

    let savedVideoUrl = typeof videoUrl === 'string' ? videoUrl.trim() : '';
    if (savedVideoUrl && savedVideoUrl.startsWith('data:')) {
      savedVideoUrl = saveBase64MediaToPublic(savedVideoUrl, 'lehenga-vid');
    }

    let finalMediaUrl =
      savedImages[0] || mediaUrl || savedVideoUrl || '/images/lehenga-orange-zardosi.jpg';
    if (mediaDataUrl && typeof mediaDataUrl === 'string' && mediaDataUrl.startsWith('data:')) {
      finalMediaUrl = saveBase64MediaToPublic(mediaDataUrl, 'lehenga');
    }

    if (savedImages.length === 0 && finalMediaUrl && mediaType !== 'video') {
      savedImages.push(finalMediaUrl);
    }

    const generatedNumber = String(outfits.length + 1).padStart(2, '0');
    const cleanCode = (code || `LOL-IND-${generatedNumber}`).toUpperCase().trim();
    const baseId =
      typeof incomingId === 'string' && incomingId.trim()
        ? incomingId.trim()
        : cleanCode.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const newOutfit: LehengaOutfit = {
      id: outfits.some((o) => o.id === baseId)
        ? `${baseId}-${Date.now().toString().slice(-4)}`
        : baseId,
      code: cleanCode,
      title: String(title).trim(),
      pricePerDay: Number(pricePerDay),
      description:
        String(description || '').trim() ||
        'Zero commitment, 100% main character energy. Wear it once for the gram and hand it back tomorrow.',
      ogHumorTagline:
        String(ogHumorTagline || '').trim() ||
        `Why buy when you can slay for ₹${Number(pricePerDay).toLocaleString('en-IN')}/day? Rent it, flex it, return it! 🔥`,
      mediaUrl: finalMediaUrl,
      mediaType:
        savedImages.length > 0
          ? 'image'
          : savedVideoUrl || mediaType === 'video'
          ? 'video'
          : 'image',
      images: savedImages,
      videoUrl: savedVideoUrl || undefined,
      vibeCategory: String(vibeCategory || '').trim() || 'Navratri Ni Pehvesh',
      sizes: Array.isArray(sizes) && sizes.length > 0 ? sizes : ['XS-S', 'M-L (Adjustable)'],
      available: true,
      createdAt: new Date().toISOString(),
    };

    const updated = [newOutfit, ...outfits];
    saveOutfits(updated);
    res.status(201).json(newOutfit);
  });

  // API: Toggle availability or update outfit (Admin)
  app.patch('/api/outfits/:id', (req, res) => {
    const adminPassword = req.headers['x-admin-password'] as string | undefined;
    if (!isValidAdminPassword(adminPassword || req.body?.password)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const outfits = loadOutfits();
    const index = outfits.findIndex((o) => o.id === req.params.id);
    if (index === -1) {
      res.status(404).json({ error: 'Outfit not found' });
      return;
    }

    const incoming = { ...req.body };
    delete incoming.retailPrice;
    delete incoming.indoreHotspot;

    if (Array.isArray(incoming.images)) {
      incoming.images = incoming.images
        .map((img: unknown) => (typeof img === 'string' ? img.trim() : ''))
        .filter(Boolean)
        .slice(0, 4)
        .map((img: string) =>
          img.startsWith('data:') ? saveBase64MediaToPublic(img, 'lehenga-img') : img
        );
    }
    if (typeof incoming.videoUrl === 'string') {
      const trimmedVideo = incoming.videoUrl.trim();
      if (trimmedVideo.startsWith('data:')) {
        incoming.videoUrl = saveBase64MediaToPublic(trimmedVideo, 'lehenga-vid');
      } else {
        incoming.videoUrl = trimmedVideo;
      }
    }

    const mergedOutfit: LehengaOutfit = {
      ...outfits[index],
      ...incoming,
      id: outfits[index].id,
    };

    if ('videoUrl' in incoming && !incoming.videoUrl) {
      delete mergedOutfit.videoUrl;
      const firstPhoto =
        (Array.isArray(mergedOutfit.images) && mergedOutfit.images[0]) ||
        (mergedOutfit.mediaType === 'image' && mergedOutfit.mediaUrl) ||
        '/images/lehenga-orange-zardosi.jpg';
      mergedOutfit.mediaType = 'image';
      mergedOutfit.mediaUrl = firstPhoto;
    }

    outfits[index] = mergedOutfit;
    saveOutfits(outfits);
    res.json(outfits[index]);
  });

  // API: Delete outfit (Admin)
  app.delete('/api/outfits/:id', (req, res) => {
    const adminPassword = req.headers['x-admin-password'] as string | undefined;
    if (!isValidAdminPassword(adminPassword)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const outfits = loadOutfits();
    const filtered = outfits.filter((o) => o.id !== req.params.id);
    saveOutfits(filtered);
    res.json({ ok: true });
  });

  // API: Bookings (Rental Compliance Funnel log)
  app.get('/api/bookings', (_req, res) => {
    const bookings = loadBookings();
    res.json(bookings);
  });

  app.post('/api/bookings', (req, res) => {
    const {
      outfitId,
      outfitCode,
      outfitTitle,
      pricePerDay,
      rentalDate,
      returnDate,
      pickupTime,
      customerName,
      customerPhone,
      promisedNextDayReturn,
      syncedToGoogleTasks,
    } = req.body;

    const bookings = loadBookings();
    const newBooking: RentalBooking = {
      id: `bk-${Date.now()}`,
      outfitId: outfitId || 'lol-custom',
      outfitCode: outfitCode || 'LOL-IND',
      outfitTitle: outfitTitle || 'LOL Designer Lehenga',
      pricePerDay: Number(pricePerDay) || 2499,
      rentalDate: rentalDate || new Date().toISOString().split('T')[0],
      returnDate: returnDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
      pickupTime: pickupTime || '01:00 PM - Afternoon Slay',
      customerName: customerName || 'Indore Baddie',
      customerPhone: customerPhone || '',
      promisedNextDayReturn: Boolean(promisedNextDayReturn),
      createdAt: new Date().toISOString(),
      syncedToGoogleTasks: Boolean(syncedToGoogleTasks),
    };

    const updated = [newBooking, ...bookings];
    saveBookings(updated);
    res.status(201).json(newBooking);
  });

  app.patch('/api/bookings/:id', (req, res) => {
    const bookings = loadBookings();
    const idx = bookings.findIndex((b) => b.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    bookings[idx] = { ...bookings[idx], ...req.body };
    saveBookings(bookings);
    res.json(bookings[idx]);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);

        // Check if a specific outfit is requested via /outfit/<id>, /share/<id>, /<id>, or ?outfit=<id>
        const rawPath = decodeURIComponent(req.path || '').replace(/^\/+|\/+$/g, '');
        let outfitQueryId = (req.query.outfit as string) || '';
        if (!outfitQueryId) {
          if (rawPath.toLowerCase().startsWith('outfit/')) {
            outfitQueryId = rawPath.slice('outfit/'.length);
          } else if (rawPath.toLowerCase().startsWith('lehenga/')) {
            outfitQueryId = rawPath.slice('lehenga/'.length);
          } else if (rawPath.toLowerCase().startsWith('share/')) {
            outfitQueryId = rawPath.slice('share/'.length);
          } else if (rawPath && rawPath.toLowerCase() !== 'admin') {
            outfitQueryId = rawPath;
          }
        }

        if (outfitQueryId) {
          const outfits = loadOutfits();
          const matched = outfits.find(
            (o) =>
              o.id.toLowerCase() === outfitQueryId.toLowerCase() ||
              o.code.toLowerCase() === outfitQueryId.toLowerCase()
          );
          if (matched) {
            const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
            const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
            const baseUrl =
              process.env.APP_URL && !process.env.APP_URL.includes('MY_APP_URL')
                ? process.env.APP_URL.replace(/\/$/, '')
                : `${protocol}://${host}`;
            template = injectDynamicOgTags(template, matched, baseUrl);
          }
        }

        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath, { index: false }));

    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      let html = fs.readFileSync(indexPath, 'utf-8');

      const rawPath = decodeURIComponent(req.path || '').replace(/^\/+|\/+$/g, '');
      let outfitQueryId = (req.query.outfit as string) || '';
      if (!outfitQueryId) {
        if (rawPath.toLowerCase().startsWith('outfit/')) {
          outfitQueryId = rawPath.slice('outfit/'.length);
        } else if (rawPath.toLowerCase().startsWith('lehenga/')) {
          outfitQueryId = rawPath.slice('lehenga/'.length);
        } else if (rawPath.toLowerCase().startsWith('share/')) {
          outfitQueryId = rawPath.slice('share/'.length);
        } else if (rawPath && rawPath.toLowerCase() !== 'admin') {
          outfitQueryId = rawPath;
        }
      }

      if (outfitQueryId) {
        const outfits = loadOutfits();
        const matched = outfits.find(
          (o) =>
            o.id.toLowerCase() === outfitQueryId.toLowerCase() ||
            o.code.toLowerCase() === outfitQueryId.toLowerCase()
        );
        if (matched) {
          const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
          const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
          const baseUrl =
            process.env.APP_URL && !process.env.APP_URL.includes('MY_APP_URL')
              ? process.env.APP_URL.replace(/\/$/, '')
              : `${protocol}://${host}`;
          html = injectDynamicOgTags(html, matched, baseUrl);
        }
      }

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LOL: Lehenga On Lease server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
