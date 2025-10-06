// server/index.js — Superhond API & static server (ESM)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import sheetsRouter from './api/sheets.js';
// import agendaRouter from './routes/agenda.js'; // optioneel

const app = express();
const PORT   = process.env.PORT || 3000;
const ORIGIN = process.env.CORS_ORIGIN || '*';

// __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// --- Middleware ---
app.use(cors({ origin: ORIGIN }));
app.use(express.json({ limit: '1mb' }));

// Static frontend (public/)
app.use(express.static(path.join(__dirname, '..', 'public'), { etag: false, maxAge: 0 }));

// ---- Health & ping ----
app.get('/health', (_req, res) => res.status(200).send('OK'));
app.get('/api/ping', (_req, res) => res.json({ ok: true, t: Date.now() }));

// ---- API routes ----
app.use('/api/sheets', sheetsRouter);   // Google Sheets proxy (CORS-vrij)
// app.use('/api/agenda', agendaRouter); // optioneel: JSON opslag

// ---- 404 fallback (API) ----
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
  if (!process.env.SUPERHOND_API_BASE) {
    console.log('⚠️  SUPERHOND_API_BASE is niet gezet. Zet deze env var op je GAS /exec URL.');
  }
});
