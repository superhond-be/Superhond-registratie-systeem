/**
 * server/index.js — Superhond server (v0.26.7)
 * - /api/config         → dynamisch uit ENV of in-memory override
 * - /api/config/set     → zet apiBase centraal (POST JSON | text/plain | GET)  [optioneel: ADMIN_TOKEN]
 * - /api/config/clear   → wist override (valt terug op ENV)                     [optioneel: ADMIN_TOKEN]
 * - /api/ping, /health  → health
 * - /api/sheets         → proxy (GAS)
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

// ── security & infra
app.set('trust proxy', true);
app.use(
  helmet({
    contentSecurityPolicy: false, // static frontend laadt eigen JS
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);
app.use(compression());

// ── body parsers: JSON én text/plain (frontend post soms text/plain)
app.use(express.json({ limit: '2mb' }));
app.use(express.text({ type: 'text/plain', limit: '2mb' }));

// ── logging & CORS
app.use(morgan('dev'));
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use(
  cors({
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN,
    credentials: false,
  })
);

// Preflight helper (niet strikt nodig met cors(), maar nice to have)
app.options('*', cors());

// ── state
let API_BASE_OVERRIDE = ''; // bv. https://script.google.com/macros/s/.../exec

// ── utils
const isValidExecUrl = (u) =>
  /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(
    String(u || '').trim()
  );

function pickApiBase() {
  if (API_BASE_OVERRIDE && isValidExecUrl(API_BASE_OVERRIDE)) return API_BASE_OVERRIDE;
  return process.env.API_BASE || '';
}

function requireAdminIfConfigured(req, res) {
  const expected = (process.env.ADMIN_TOKEN || '').trim();
  if (!expected) return true; // geen gating → toegestaan

  // Zoek token in header, query of body
  const headerToken = (req.headers['x-admin-token'] || '').toString().trim();
  const queryToken = (req.query.adminToken || '').toString().trim();
  const bodyToken =
    (req.is('application/json') && (req.body?.adminToken || '')) ||
    (req.is('text/plain') ? safeJson(req.body)?.adminToken || '' : '');
  const provided = headerToken || queryToken || bodyToken || '';

  if (provided && provided === expected) return true;

  res.status(401).json({ ok: false, error: 'Unauthorized (ADMIN_TOKEN vereist)' });
  return false;
}

function safeJson(x) {
  try {
    return JSON.parse(String(x || ''));
  } catch {
    return {};
  }
}

// ─────────────────────────── Health ───────────────────────────
app.get('/api/ping', (req, res) => res.json({ ok: true, t: Date.now() }));
app.get('/health', (req, res) => res.type('text/plain').send('OK'));

// ─────────────────────────── Config endpoints ───────────────────────────
app.get('/api/config', (req, res) => {
  const source = API_BASE_OVERRIDE ? 'override' : 'env';
  res.setHeader('X-Config-Source', source);
  res.json({
    apiBase: pickApiBase(),
    version: '0.26.7',
    env: process.env.NODE_ENV || 'prod',
    adminToken: process.env.ADMIN_TOKEN ? 'set' : '', // hint (geen lek)
    source,
  });
});

/**
 * Zet de apiBase centraal (in-memory).
 * - POST /api/config/set  body: { apiBase, adminToken? }  (application/json)
 * - POST /api/config/set  body: '{"apiBase":".../exec","adminToken":"..."}' (text/plain)
 * - GET  /api/config/set?apiBase=.../exec&adminToken=...
 * Als ADMIN_TOKEN niet staat in ENV → geen gating (open).
 */
app.all('/api/config/set', (req, res) => {
  if (!requireAdminIfConfigured(req, res)) return;

  let candidate = '';

  if (req.method === 'GET') {
    candidate = String(req.query.apiBase || '');
  } else {
    if (req.is('application/json')) {
      candidate = String(req.body?.apiBase || '');
    } else if (req.is('text/plain')) {
      const j = safeJson(req.body);
      candidate = String(j.apiBase || req.body || '');
    } else {
      // andere content-types: probeer generiek
      candidate = String(req.body?.apiBase || '');
    }
  }

  if (!isValidExecUrl(candidate)) {
    return res
      .status(400)
      .json({ ok: false, error: 'Ongeldige apiBase (verwacht een Google Apps Script /exec URL)' });
  }

  API_BASE_OVERRIDE = candidate.trim();
  console.log('🔧 apiBase OVERRIDE gezet →', API_BASE_OVERRIDE);
  return res.json({
    ok: true,
    apiBase: API_BASE_OVERRIDE,
    note: 'Centrale apiBase is nu actief (in-memory override).',
  });
});

// Wist de in-memory override (terug naar ENV)
app.post('/api/config/clear', (req, res) => {
  if (!requireAdminIfConfigured(req, res)) return;

  API_BASE_OVERRIDE = '';
  console.log('🧹 apiBase OVERRIDE gewist; terug naar ENV');
  return res.json({ ok: true, apiBase: pickApiBase(), note: 'Override gewist; terug naar ENV.' });
});

// ─────────────────────────── Proxy naar GAS ───────────────────────────
app.all('/api/sheets', async (req, res) => {
  const target = pickApiBase();
  if (!target) return res.status(404).json({ error: 'API_BASE ontbreekt' });

  try {
    const method = req.method;
    const qs = req.originalUrl.split('?')[1] || '';
    const url = `${target}${qs ? `?${qs}` : ''}`;

    // Body + headers
    const init = { method, mode: 'cors', headers: {} };
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      if (req.is('application/json')) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(req.body || {});
      } else if (req.is('text/plain')) {
        init.headers['Content-Type'] = 'text/plain';
        init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      } else {
        init.headers['Content-Type'] = 'application/json';
        try {
          init.body = JSON.stringify(req.body || {});
        } catch {
          init.headers['Content-Type'] = 'text/plain';
          init.body = String(req.body || '');
        }
      }
    }

    const r = await fetch(url, init);
    const text = await r.text();

    // probeer JSON; anders raw doorsturen
    try {
      const data = JSON.parse(text);
      res.status(r.status).json(data);
    } catch {
      res.status(r.status).type('text/plain').send(text);
    }
  } catch (e) {
    console.error('Proxy error:', e);
    res.status(502).json({ error: 'proxy_error', detail: String(e?.message || e) });
  }
});

// ─────────────────────────── Static site ───────────────────────────
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir, { extensions: ['html'] }));

// Fallback naar dashboard (pas pad aan indien nodig)
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'dashboard', 'index.html'));
});

// ─────────────────────────── Start ───────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Superhond server @ http://localhost:${PORT}`);
  console.log(`   CORS_ORIGIN = ${CORS_ORIGIN}`);
  console.log(`   ADMIN_TOKEN ${process.env.ADMIN_TOKEN ? 'is set (protected)' : 'not set (open)'} `);
});
