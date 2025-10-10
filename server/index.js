/**
 * server/index.js — Superhond server (v0.26.5)
 * - /api/config      → dynamisch uit ENV of override
 * - /api/config/set  → zet apiBase centraal (vanuit testprogramma)
 * - /api/ping        → health
 * - /api/sheets      → optionele proxy (GAS)
 * - statics uit /public
 */

import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── middlewares
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// CORS: laat frontends toe (pas origin aan indien nodig)
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN }));

// In-memory override, kan live gezet worden via /api/config/set
let API_BASE_OVERRIDE = '';   // bv. https://script.google.com/macros/s/.../exec

// Kleine helper: valideer een echte GAS /exec URL
function isValidExecUrl(u) {
  return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(String(u || '').trim());
}

// ─────────────────────────── Config endpoints ───────────────────────────
app.get('/api/config', (req, res) => {
  const apiBase = (API_BASE_OVERRIDE && isValidExecUrl(API_BASE_OVERRIDE))
    ? API_BASE_OVERRIDE
    : (process.env.API_BASE || '');

  res.json({
    apiBase,
    version: '0.26.5',
    env: process.env.NODE_ENV || 'prod',
    adminToken: process.env.ADMIN_TOKEN || ''   // voor later, nu nog niet gebruikt
  });
});

/**
 * Zet de apiBase centraal, rechtstreeks vanuit je testprogramma of een admin-tool.
 * Gebruik POST (JSON) of GET met querystring.
 *  - POST  /api/config/set   body: { apiBase:"https://script.google.com/.../exec" }
 *  - GET   /api/config/set?apiBase=...
 */
app.all('/api/config/set', (req, res) => {
  const candidate =
    (req.method === 'GET' ? req.query.apiBase : (req.body && req.body.apiBase)) || '';

  if (!isValidExecUrl(candidate)) {
    return res.status(400).json({
      ok: false,
      error: 'Ongeldige apiBase (verwacht een Google Apps Script /exec URL)'
    });
  }

  API_BASE_OVERRIDE = String(candidate).trim();
  return res.json({ ok: true, apiBase: API_BASE_OVERRIDE, note: 'Centrale apiBase is nu actief' });
});

// Health
app.get('/api/ping', (req, res) => res.json({ ok: true, t: Date.now() }));

// ─────────────────────────── Optionele proxy ───────────────────────────
app.all('/api/sheets', async (req, res) => {
  const target = (API_BASE_OVERRIDE && isValidExecUrl(API_BASE_OVERRIDE))
    ? API_BASE_OVERRIDE
    : (process.env.API_BASE || '');

  if (!target) return res.status(404).json({ error: 'API_BASE ontbreekt' });

  try {
    const method = req.method;
    const qs = req.originalUrl.split('?')[1] || '';
    const url = `${target}${qs ? `?${qs}` : ''}`;

    const init = { method, mode: 'cors', headers: {} };
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(req.body || {});
    }

    const r = await fetch(url, init);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    res.status(r.status).send(data);
  } catch (e) {
    console.error('Proxy error:', e);
    res.status(502).json({ error: 'proxy_error', detail: String(e?.message || e) });
  }
});

// ─────────────────────────── Static site ───────────────────────────
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));

// Fallback naar dashboard (pas aan indien nodig)
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'dashboard', 'index.html'));
});

// ─────────────────────────── Start ───────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Superhond server @ http://localhost:${PORT}`);
  console.log(`   CORS_ORIGIN = ${CORS_ORIGIN}`);
});
