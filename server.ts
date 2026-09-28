import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
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

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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
  fs.writeFileSync(TESTIMONIALS_FILE, JSON.stringify(list, null, 2), 'utf-8');
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
    const tsContent = `import { LehengaOutfit } from '../types';\n\nexport const INITIAL_OUTFITS: LehengaOutfit[] = ${JSON.stringify(outfits, null, 2)};\n`;
    fs.writeFileSync(initialOutfitsFile, tsContent, 'utf-8');
  } catch (err) {
    console.error('Error syncing initialOutfits.ts:', err);
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

  // Also write videos directly to public/ root for static Vite production builds
  if (ext === 'mp4' || ext === 'webm' || ext === 'mov') {
    const publicRootFile = path.join(__dirname, 'public', filename);
    fs.writeFileSync(publicRootFile, buffer);
    if (ext === 'mp4') {
      fs.writeFileSync(path.join(__dirname, 'public', 'lehenga-reel.mp4'), buffer);
    }
    return `/${filename}`;
  }

  return `/uploads/${filename}`;
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
  app.use(
    '/uploads',
    express.static(UPLOADS_DIR, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.mp4') || filePath.endsWith('.webm')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Accept-Ranges', 'bytes');
        }
      },
    })
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
  app.post('/api/upload-media', (req, res) => {
    try {
      const { dataUrl, prefix } = req.body;
      if (!dataUrl || typeof dataUrl !== 'string') {
        res.status(400).json({ error: 'Missing dataUrl' });
        return;
      }
      const savedUrl = saveBase64MediaToPublic(dataUrl, prefix || 'media');
      res.json({ ok: true, url: savedUrl });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Upload failed' });
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

  // API: Get & Create Customer Testimonials (Indore Client Reviews + 1 Photo)
  app.get('/api/testimonials', (_req, res) => {
    res.json(loadTestimonials());
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
