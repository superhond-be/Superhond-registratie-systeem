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

function isHTML(s = '') {
  return /^\s*</.test(String(s).trim());
}

function sanitizeBaseOverride(candidate = '') {
  // Alleen toestaan voor script.google.com/macros/s/…/exec
  try {
    const u = new URL(candidate);
    if (u.hostname === 'script.google.com' && u.pathname.startsWith('/macros/s/')) {
      return `${u.origin}${u.pathname}`;
    }
    return '';
  } catch {
    return '';
  }
}

async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(new Error('timeout')), ms);
  try {
    return await _fetch(url, { signal: ac.signal });
  } finally {
    clearTimeout(to);
  }
}

/**
 * GET /api/sheets?mode=ping|klanten|honden
 * Optioneel (alleen als env ontbreekt): ?base=https://script.google.com/macros/s/.../exec
 */
router.get('/', async (req, res) => {
  try {
    const mode = String(req.query.mode || 'ping').toLowerCase();

    // Kies basis-URL: env is leidend; als die ontbreekt, een streng gevalideerde override toelaten.
    let base = GAS_BASE;
    if (!base) {
      const override = sanitizeBaseOverride(String(req.query.base || ''));
      if (!override) {
        return res.status(500).json({ ok: false, error: 'SUPERHOND_API_BASE ontbreekt (of onveilige base override).' });
      }
      base = override;
    }

    const url = `${base}?mode=${encodeURIComponent(mode)}&t=${Date.now()}`;
    const upstream = await fetchWithTimeout(url, TIMEOUT_MS);
    const text = await upstream.text();

    if (!upstream.ok) {
      return res
        .status(upstream.status)
        .json({ ok: false, error: `Upstream ${upstream.status}`, body: text.slice(0, 200) });
    }

    if (isHTML(text)) {
      return res.status(502).json({
        ok: false,
        error: 'Upstream gaf HTML (login/fout). Is de Web App publiek (Anyone, even anonymous) en gebruik je de /exec URL?',
      });
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return res.status(502).json({ ok: false, error: 'Upstream gaf ongeldige JSON' });
    }

    res.set('Cache-Control', 'no-store').json(json);
  } catch (err) {
    const msg = err?.name === 'AbortError' || err?.message === 'timeout'
      ? 'Timeout naar upstream'
      : (err?.message || String(err));
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
