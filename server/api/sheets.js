/server/api/sheets.js
```js
// server/api/sheets.js — CORS-vrije proxy naar Google Apps Script Web App (ESM)
import express from 'express';

const router = express.Router();

// In Node 18+ is fetch global; fallback naar node-fetch wanneer nodig.
let _fetch = globalThis.fetch;
if (!_fetch) {
  const mod = await import('node-fetch');
  _fetch = mod.default;
}

const TIMEOUT_MS = 12000;
const GAS_BASE   = (process.env.SUPERHOND_API_BASE || '').trim(); // bv. https://script.google.com/macros/s/.../exec

// ───────────────────────── Helpers ─────────────────────────
function isHTML(s = '') {
  return /^\s*</.test(String(s).trim());
}

function sanitizeBaseOverride(candidate = '') {
  // Alleen toestaan voor script.google.com/macros/s/.../exec (pad exact)
  try {
    const u = new URL(candidate);
    if (
      u.hostname === 'script.google.com' &&
      u.pathname.startsWith('/macros/s/') &&
      u.pathname.endsWith('/exec')
    ) {
      return `${u.origin}${u.pathname}`;
    }
    return '';
  } catch {
    return '';
  }
}

async function fetchWithTimeout(url, ms = TIMEOUT_MS, init = {}) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(new Error('timeout')), ms);
  try {
    return await _fetch(url, { signal: ac.signal, ...init });
  } finally {
    clearTimeout(to);
  }
}

function buildUpstreamUrl(req, base) {
  const url = new URL(base);
  // kopieer alle queryparams behalve 'base'
  for (const [k, v] of Object.entries(req.query || {})) {
    if (k === 'base') continue;
    if (v != null) url.searchParams.set(k, String(v));
  }
  // kleine bust tegen caches
  url.searchParams.set('t', Date.now().toString());
  return url.toString();
}

function upstreamError(res, upstream, text) {
  const peek = String(text || '').trim().slice(0, 200).replace(/\s+/g, ' ');
  return res
    .status(upstream.status)
    .json({ ok: false, error: `Upstream ${upstream.status}`, body: peek });
}

function ensureBase(req) {
  // Kies basis-URL: env is leidend; als die ontbreekt, een streng gevalideerde override toelaten.
  let base = GAS_BASE;
  if (!base) {
    const override = sanitizeBaseOverride(String(req.query?.base || ''));
    if (!override) return '';
    base = override;
  }
  return base;
}

// ───────────────────────── Routes ─────────────────────────
// GET /api/sheets?mode=ping|klanten|honden|...
router.get('/', async (req, res) => {
  try {
    const base = ensureBase(req);
    if (!base) {
      return res.status(500).json({ ok: false, error: 'SUPERHOND_API_BASE ontbreekt (of onveilige base override).' });
    }

    const url = buildUpstreamUrl(req, base);
    const upstream = await fetchWithTimeout(url, TIMEOUT_MS, { method: 'GET', cache: 'no-store' });
    const text = await upstream.text();

    if (!upstream.ok) return upstreamError(res, upstream, text);
    if (isHTML(text)) {
      return res.status(502).json({
        ok: false,
        error: 'Upstream gaf HTML (login/fout). Is de Web App publiek (Iedereen, zelfs anoniem) en gebruik je de /exec URL?',
      });
    }

    let json;
    try { json = JSON.parse(text); }
    catch { return res.status(502).json({ ok: false, error: 'Upstream gaf ongeldige JSON' }); }

    res.set('Cache-Control', 'no-store').json(json);
  } catch (err) {
    const msg = err?.name === 'AbortError' || err?.message === 'timeout'
      ? 'Timeout naar upstream'
      : (err?.message || String(err));
    res.status(500).json({ ok: false, error: msg });
  }
});

// POST /api/sheets?mode=saveKlant
// Body wordt text/plain (string) doorgestuurd naar GAS om preflight te vermijden.
router.post('/', async (req, res) => {
  try {
    const base = ensureBase(req);
    if (!base) {
      return res.status(500).json({ ok: false, error: 'SUPERHOND_API_BASE ontbreekt (of onveilige base override).' });
    }

    const url = buildUpstreamUrl(req, base);
    const bodyText = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});

    const upstream = await fetchWithTimeout(url, TIMEOUT_MS, {
      method: 'POST',
      // GAS doPost leest e.postData.contents, dus text/plain is ideaal (geen CORS preflight)
      headers: { 'Content-Type': 'text/plain' },
      body: bodyText,
      cache: 'no-store'
    });

    const text = await upstream.text();

    if (!upstream.ok) return upstreamError(res, upstream, text);
    if (isHTML(text)) {
      return res.status(502).json({
        ok: false,
        error: 'Upstream gaf HTML (login/fout) bij POST. Is de Web App publiek en is dit de /exec deployment?',
      });
    }

    let json;
    try { json = JSON.parse(text); }
    catch { return res.status(502).json({ ok: false, error: 'Upstream gaf ongeldige JSON' }); }

    res.set('Cache-Control', 'no-store').json(json);
  } catch (err) {
    const msg = err?.name === 'AbortError' || err?.message === 'timeout'
      ? 'Timeout naar upstream'
      : (err?.message || String(err));
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
