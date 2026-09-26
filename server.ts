import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { INITIAL_OUTFITS } from './src/data/initialOutfits.ts';
import { DEFAULT_SITE_SETTINGS } from './src/types.ts';
import type { LehengaOutfit, RentalBooking, SiteSettings } from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'site-settings.json');

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

function loadOutfits(): LehengaOutfit[] {
  try {
    if (fs.existsSync(CATALOG_FILE)) {
      const raw = fs.readFileSync(CATALOG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
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
      customerPhone: '+91 98260 44112',
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

  const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
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
  const shareUrl = `${baseUrl}/?outfit=${encodeURIComponent(outfit.id)}`;

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
      const filePath = path.join(UPLOADS_DIR, 'hero-banner.mp4');
      fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'));
      const newUrl = `/uploads/hero-banner.mp4?t=${Date.now()}`;
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
      title,
      code,
      pricePerDay,
      retailPrice,
      description,
      ogHumorTagline,
      mediaDataUrl,
      mediaUrl,
      mediaType,
      vibeCategory,
      sizes,
      indoreHotspot,
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
    let finalMediaUrl = mediaUrl || '/images/lehenga-orange-zardosi.jpg';
    if (mediaDataUrl && typeof mediaDataUrl === 'string' && mediaDataUrl.startsWith('data:')) {
      finalMediaUrl = saveBase64MediaToPublic(mediaDataUrl, 'lehenga');
    }

    const generatedNumber = String(outfits.length + 1).padStart(2, '0');
    const cleanCode = (code || `LOL-IND-${generatedNumber}`).toUpperCase().trim();
    const id = cleanCode.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const newOutfit: LehengaOutfit = {
      id: outfits.some((o) => o.id === id) ? `${id}-${Date.now().toString().slice(-4)}` : id,
      code: cleanCode,
      title: String(title).trim(),
      pricePerDay: Number(pricePerDay),
      retailPrice: Number(retailPrice) || Number(pricePerDay) * 20,
      description:
        String(description || '').trim() ||
        'Zero commitment, 100% main character energy. Wear it once for the gram and hand it back tomorrow.',
      ogHumorTagline:
        String(ogHumorTagline || '').trim() ||
        `Why buy when you can slay for ₹${Number(pricePerDay).toLocaleString('en-IN')}/day? Rent it, flex it, return it! 🔥`,
      mediaUrl: finalMediaUrl,
      mediaType: mediaType === 'video' ? 'video' : 'image',
      vibeCategory: vibeCategory || 'Sangeet Main Character',
      sizes: Array.isArray(sizes) && sizes.length > 0 ? sizes : ['XS-S', 'M-L (Adjustable)'],
      indoreHotspot: String(indoreHotspot || '').trim() || 'Indore Sangeet & Wedding Certified',
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

    outfits[index] = {
      ...outfits[index],
      ...req.body,
      id: outfits[index].id,
    };
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

        // Check if a specific outfit is requested via ?outfit=<id> or /share/<id>
        const outfitQueryId =
          (req.query.outfit as string) ||
          (req.path.startsWith('/share/') ? req.path.replace('/share/', '') : '');

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

      const outfitQueryId =
        (req.query.outfit as string) ||
        (req.path.startsWith('/share/') ? req.path.replace('/share/', '') : '');

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
