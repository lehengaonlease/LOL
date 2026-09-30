import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import heicConvert from 'heic-convert';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';

const execFileAsync = promisify(execFile);
const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(cfg);
const db = getFirestore(app, cfg.firestoreDatabaseId);
const WRITE_TOKEN = 'lol-sanjeevani-studio-sync-v1';
const UPLOADS_DIR = path.resolve('public/uploads');
const MEDIA_STORE_FILE = path.resolve('data/media-store.json');
const CATALOG_FILE = path.resolve('data/catalog.json');

async function saveBufferToMediaAssets(assetId: string, buf: Buffer, mimeType: string) {
  const safeId = assetId.replace(/[^a-zA-Z0-9._-]/g, '_');
  const CHUNK_SIZE = 550 * 1024;
  const totalChunks = Math.max(1, Math.ceil(buf.length / CHUNK_SIZE));
  for (let idx = 0; idx < totalChunks; idx++) {
    const slice = buf.subarray(idx * CHUNK_SIZE, Math.min(buf.length, (idx + 1) * CHUNK_SIZE));
    await setDoc(doc(db, 'media_assets', safeId, 'chunks', String(idx).padStart(5, '0')), {
      index: idx,
      data: slice.toString('base64'),
      writeToken: WRITE_TOKEN,
    });
  }
  await setDoc(doc(db, 'media_assets', safeId), {
    mimeType,
    totalChunks,
    createdAt: Date.now(),
    writeToken: WRITE_TOKEN,
  });
  console.log(`Synced to Firestore media_assets/${safeId} (${(buf.length / 1024).toFixed(1)} KB, ${totalChunks} chunks)`);
}

async function loadBufferFromMediaAssets(assetId: string): Promise<Buffer | null> {
  const snap = await getDocs(
    query(collection(db, 'media_assets', assetId, 'chunks'), orderBy('index', 'asc'))
  );
  if (snap.empty) return null;
  const parts: Buffer[] = [];
  snap.forEach((d) => {
    const b64 = d.data().data;
    if (typeof b64 === 'string') parts.push(Buffer.from(b64, 'base64'));
  });
  return parts.length > 0 ? Buffer.concat(parts) : null;
}

async function ensureWebpBuffer(rawBuf: Buffer, tempTag: string): Promise<Buffer> {
  const header = rawBuf.subarray(4, 12).toString('ascii');
  let inputBuf = rawBuf;
  if (
    header.includes('ftypheic') ||
    header.includes('ftypmif1') ||
    header.includes('ftypheix') ||
    header.includes('ftyphevc')
  ) {
    console.log(`Converting HEIC buffer for ${tempTag}...`);
    const jpeg = await heicConvert({ buffer: rawBuf, format: 'JPEG', quality: 0.9 });
    inputBuf = Buffer.from(jpeg);
  }
  const tmpIn = path.join(UPLOADS_DIR, `.tmp-${tempTag}.in`);
  const tmpOut = path.join(UPLOADS_DIR, `.tmp-${tempTag}.webp`);
  fs.writeFileSync(tmpIn, inputBuf);
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      tmpIn,
      '-vf',
      "scale='min(1200,iw)':-2",
      '-q:v',
      '82',
      tmpOut,
    ]);
    const out = fs.readFileSync(tmpOut);
    return out;
  } finally {
    if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn);
    if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
  }
}

async function compressVideoFile(filePath: string) {
  const stat = fs.statSync(filePath);
  if (stat.size <= 4_200_000) return;
  console.log(`Compressing video ${path.basename(filePath)} (${(stat.size / 1024 / 1024).toFixed(1)} MB)...`);
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
    console.log(`Compressed ${path.basename(filePath)} -> ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB`);
  }
}

async function main() {
  // 1. Repair any cloud-media:// assets uploaded from ais-pre
  for (const cloudId of [
    'lehenga-img-4-1790755854106-hvsl4',
    'lehenga-img-3-1790755931983-xf2io',
    'lehenga-img-4-1790755956491-c7p9a',
  ]) {
    const raw = await loadBufferFromMediaAssets(cloudId);
    if (raw && raw.length > 0) {
      const webpBuf = await ensureWebpBuffer(raw, cloudId);
      const localFile = `${cloudId}.webp`;
      fs.writeFileSync(path.join(UPLOADS_DIR, localFile), webpBuf);
      await saveBufferToMediaAssets(cloudId, webpBuf, 'image/webp');
      await saveBufferToMediaAssets(localFile, webpBuf, 'image/webp');
    }
  }

  // 2. Compress large videos in public/uploads/
  const files = fs.readdirSync(UPLOADS_DIR).filter((f) => !f.startsWith('.'));
  for (const f of files) {
    if (f.endsWith('.mp4') && f !== 'hero-banner.mp4') {
      await compressVideoFile(path.join(UPLOADS_DIR, f));
    }
  }

  // 3. Sync all lehenga photos & videos in public/uploads/ to Firestore media_assets & media-store.json
  const mediaStore: Record<string, string> = fs.existsSync(MEDIA_STORE_FILE)
    ? JSON.parse(fs.readFileSync(MEDIA_STORE_FILE, 'utf-8'))
    : {};

  for (const f of fs.readdirSync(UPLOADS_DIR)) {
    if (f.startsWith('.') || f === 'hero-banner.mp4' || f === 'hero-poster.jpg') continue;
    const full = path.join(UPLOADS_DIR, f);
    const buf = fs.readFileSync(full);
    const mime = f.endsWith('.mp4') ? 'video/mp4' : 'image/webp';
    await saveBufferToMediaAssets(f, buf, mime);
    if (buf.length <= 6_500_000) {
      mediaStore[f] = buf.toString('base64');
    }
  }
  fs.writeFileSync(MEDIA_STORE_FILE, JSON.stringify(mediaStore), 'utf-8');

  // 4. Clean up outfits in Firestore and data/catalog.json so all URLs are clean /uploads/... paths
  const snap = await getDocs(collection(db, 'outfits'));
  const updatedOutfits: any[] = [];

  for (const d of snap.docs) {
    const o = d.data();
    let videoUrl = o.videoUrl || '';
    let images: string[] = Array.isArray(o.images) ? [...o.images] : [];

    if (d.id === 'lol-custom-1790667856104') {
      videoUrl = '/uploads/lol-custom-1790667856104-video-1790754679475_IMG_4430.mp4';
      images = [
        '/uploads/lehengas-lol-custom-1790667856104-img-1.webp',
        '/uploads/lehengas-lol-custom-1790667856104-img-2.webp',
        '/uploads/lehengas-lol-custom-1790667856104-img-3.webp',
        '/uploads/lol-custom-1790667856104-img-4-1790753481129_IMG_4295.webp',
      ];
    } else if (d.id === 'lol-custom-1790667630490') {
      videoUrl = '/uploads/lehenga-video-1790671005167-q60kh.mp4';
      images = [
        '/uploads/lehengas-lol-custom-1790667630490-img-1.webp',
        '/uploads/lehengas-lol-custom-1790667630490-img-2.webp',
        fs.existsSync(path.join(UPLOADS_DIR, 'lehenga-img-3-1790755931983-xf2io.webp'))
          ? '/uploads/lehenga-img-3-1790755931983-xf2io.webp'
          : '/uploads/lehengas-lol-custom-1790667630490-img-3.webp',
        fs.existsSync(path.join(UPLOADS_DIR, 'lehenga-img-4-1790755956491-c7p9a.webp'))
          ? '/uploads/lehenga-img-4-1790755956491-c7p9a.webp'
          : '/uploads/lehengas-lol-custom-1790667630490-img-3.webp',
      ];
    } else if (d.id === 'lol-custom-1790537581891') {
      videoUrl = '/uploads/lol-custom-1790537581891-video-1790754762813_IMG_4447.mp4';
      images = [
        '/uploads/lehengas-lol-custom-1790537581891-img-1.webp',
        '/uploads/lehengas-lol-custom-1790537581891-img-2.webp',
        '/uploads/lol-custom-1790537581891-img-3-1790753634596_IMG_4344.webp',
        '/uploads/lol-custom-1790537581891-img-4-1790753640236_IMG_4338.webp',
      ];
    }

    const nextDoc = {
      ...o,
      mediaType: 'image',
      mediaUrl: images[0],
      images,
      mediaUrls: images,
      videoUrl,
      updatedAt: Date.now(),
      writeToken: WRITE_TOKEN,
    };
    await setDoc(doc(db, 'outfits', d.id), nextDoc);
    const { writeToken, ...cleanLocal } = nextDoc;
    updatedOutfits.push(cleanLocal);
    console.log(`Updated outfit ${d.id}: video=${videoUrl}, photos=${images.length}`);
  }

  fs.writeFileSync(CATALOG_FILE, JSON.stringify(updatedOutfits, null, 2), 'utf-8');
  console.log('ALL DONE!');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
