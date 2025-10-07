/server/index.js
```js
// server/index.js — Superhond API & static server (ESM, Render/Node ready)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

import sheetsRouter from './api/sheets.js'; // Google Apps Script proxy (GET/POST)

// ────────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────────
const app = express();
const PORT        = process.env.PORT || 3000;
const ORIGIN      = process.env.CORS_ORIGIN || '*';
const API_BASE    = (process.env.SUPERHOND_API_BASE || '').trim(); // jouw GAS /exec
const NODE_ENV    = process.env.NODE_ENV || 'production';

// __dirname equivalent in ESM
const __filename  = fileURLToPath(import.meta.url);
const __dirname   = path.dirname(__filename);
const PUBLIC_DIR  = path.join(__dirname, '..', 'public');

// ────────────────────────────────────────────────────────────────────────────────
// Middleware
// ────────────────────────────────────────────────────────────────────────────────
app.set('trust proxy', true);

// CORS voor frontend & API
app.use(cors({ origin: ORIGIN }));

// Preflight voor alle /api/* routes
app.options('/api/*', cors({ origin: ORIGIN }));

// JSON body parser (voor eigen API's)
app.use(express.json({ limit: '1mb' }));

// Text body parser voor proxied POSTs (GAS accepteert text/plain om preflight te vermijden)
app.use('/api/sheets', express.text({ type: '*/*', limit: '1mb' }));

// Statische frontend (public/)
// - extensions:["html"] laat /pad zonder trailing slash ook index.html vinden
app.use(
  express.static(PUBLIC_DIR, {
    etag: false,
    maxAge: 0,
    extensions: ['html']
  })
);

// ────────────────────────────────────────────────────────────────────────────────
// Health & ping
// ────────────────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.status(200).send('OK'));
app.get('/api/ping', (_req, res) => res.json({ ok: true, t: Date.now() }));

// ────────────────────────────────────────────────────────────────────────────────
// Centrale config (gebruikt door /public/js/layout.js → resolveApiBase())
// ────────────────────────────────────────────────────────────────────────────────
app.get('/api/config', async (_req, res) => {
  let version = '';
  try {
    const vPath = path.join(__dirname, '..', 'version.json');
    const raw = await fs.readFile(vPath, 'utf8');
    version = JSON.parse(raw)?.version || '';
  } catch { /* version optional */ }

  res.set('Cache-Control', 'no-store'); // altijd vers
  res.json({
    ok: true,
    apiBase: API_BASE,   // GAS /exec URL uit env
    version,             // handig voor footer/topbar
    env: NODE_ENV
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// API routes
// ────────────────────────────────────────────────────────────────────────────────
app.use('/api/sheets', sheetsRouter); // Google Sheets proxy (CORS-vrij naar GAS)

// ────────────────────────────────────────────────────────────────────────────────
// Static fallback: serveer submap-indexen (bv. /klanten/, /dashboard/)
// ────────────────────────────────────────────────────────────────────────────────
app.use(async (req, res, next) => {
  // Alleen non-API requests
  if (req.path.startsWith('/api/')) return next();

  // Probeer /public/<path>/index.html te serveren
  // - werkt voor /klanten/, /honden/, /dashboard/ etc.
  try {
    const candidate = path.join(PUBLIC_DIR, req.path, 'index.html');
    const stat = await fs.stat(candidate).catch(() => null);
    if (stat && stat.isFile()) {
      res.set('Cache-Control', 'no-store');
      return res.sendFile(candidate);
    }
  } catch { /* ignore */ }

  return next();
});

// ────────────────────────────────────────────────────────────────────────────────
/** 404 voor resterende /api/ requests */
// ────────────────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'Not found' });
  }
  return next();
});

// ────────────────────────────────────────────────────────────────────────────────
// Generic error handler
// ────────────────────────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('💥 Server error:', err);
  res.status(500).json({ ok: false, error: err?.message || String(err) });
});

// ────────────────────────────────────────────────────────────────────────────────
// Start
// ────────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🐶 Superhond server draait op http://localhost:${PORT}`);
  console.log(`   CORS_ORIGIN: ${ORIGIN}`);
  if (!API_BASE) {
    console.log('⚠️  SUPERHOND_API_BASE is niet gezet. Zet deze env var op je GAS /exec URL.');
    console.log('   Frontend kan tijdelijk ?apiBase=… gebruiken of /api/config mocken.');
  } else {
    console.log(`   SUPERHOND_API_BASE: ${API_BASE}`);
  }
});
