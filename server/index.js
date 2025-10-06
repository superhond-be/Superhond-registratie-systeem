// server/index.js — Superhond API & static server (ESM)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

import sheetsRouter from './api/sheets.js';
// import agendaRouter from './routes/agenda.js'; // optioneel

const app = express();
const PORT   = process.env.PORT || 3000;
const ORIGIN = process.env.CORS_ORIGIN || '*';
const API_BASE = (process.env.SUPERHOND_API_BASE || '').trim();

// __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// --- Middleware ---
app.use(cors({ origin: ORIGIN }));                // CORS voor frontend
app.options('/api/*', cors({ origin: ORIGIN }));  // Preflight
app.use(express.json({ limit: '1mb' }));

// Static frontend (public/)
app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    etag: false,
    maxAge: 0,
  })
);

// ---- Health & ping ----
app.get('/health', (_req, res) => res.status(200).send('OK'));
app.get('/api/ping', (_req, res) => res.json({ ok: true, t: Date.now() }));

// ---- Centrale config (voor alle devices) ----
// Gebruikt door /public/js/layout.js → resolveApiBase()
app.get('/api/config', async (_req, res) => {
  // optioneel: lees version.json als aanwezig
  let version = '';
  try {
    const vPath = path.join(__dirname, '..', 'version.json');
    const raw = await fs.readFile(vPath, 'utf8');
    version = JSON.parse(raw)?.version || '';
  } catch (_) {}

  res.set('Cache-Control', 'no-store'); // altijd vers
  res.json({
    ok: true,
    apiBase: API_BASE,      // jouw GAS /exec URL uit env
    version,                // handig voor footer/topbar
    env: process.env.NODE_ENV || 'production'
  });
});

// ---- API routes ----
app.use('/api/sheets', sheetsRouter);   // Google Sheets proxy (CORS-vrij)
// app.use('/api/agenda', agendaRouter); // optioneel: JSON opslag

// ---- 404 fallback (alleen voor /api/) ----
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'Not found' });
  }
  return next();
});

// ---- Generic error handler ----
app.use((err, _req, res, _next) => {
  console.error('💥 Server error:', err);
  res.status(500).json({ ok: false, error: err?.message || String(err) });
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`🐶 Superhond API actief op :${PORT}`);
  console.log(`   CORS_ORIGIN: ${ORIGIN}`);
  if (!API_BASE) {
    console.log('⚠️  SUPERHOND_API_BASE is niet gezet. Zet deze env var op je GAS /exec URL.');
    console.log('   (Frontends kunnen tijdelijk ?apiBase=… gebruiken of de testpagina.)');
  } else {
    console.log(`   SUPERHOND_API_BASE: ${API_BASE}`);
  }
});
