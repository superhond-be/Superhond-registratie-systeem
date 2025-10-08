// server/api/sheets.js — CORS-vrije proxy naar Google Apps Script Web App (ESM)
// Env: SUPERHOND_API_BASE = https://script.google.com/macros/s/AKfycb.../exec
import { Router } from 'express';

const router = Router();
const TIMEOUT_MS = 12_000;
const NODE_ENV = process.env.NODE_ENV || 'production';
const SUPERHOND_API_BASE = (process.env.SUPERHOND_API_BASE || '').trim(); // leidend

// ───────────────────────── Helpers ─────────────────────────
const isHTML = (s = '') => /^\s*</.test(String(s).trim());

function sanitizeExecUrl(candidate = '') {
  try {
    const u = new URL(candidate);
    const okHost = u.hostname === 'script.google.com';
    const okPath = u.pathname.startsWith('/macros/s/') && u.pathname.endsWith('/exec');
    return okHost && okPath ? `${u.origin}${u.pathname}` : '';
  } catch {
    return '';
  }
}

/** Alleen als SUPERHOND_API_BASE ontbreekt, en alléén een strikte /exec URL. 
 *  Optioneel nog strenger: alleen buiten production. */
function resolveBase(req) {
  if (SUPERHOND_API_BASE) return SUPERHOND_API_BASE;
  const override = String(req.query?.base || '');
  if (!override) return '';
  // In production: permit maar STRIKT gevalideerd; anders leeg.
  const safe = sanitizeExecUrl(override);
  if (!safe) return '';
  if (NODE_ENV === 'production') return safe; // nog steeds strikt
  return safe; // in dev ook oké
}

async function fetchWithTimeout(url, init = {}, ms = TIMEOUT_MS) {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(new Error('timeout')), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal, redirect: 'follow', cache: 'no-store' });
  } finally {
    clearTimeout(id);
  }
}

function passThroughContentType(res, upstream) {
  const ct = upstream.headers.get('content-type');
  if (ct) res.set('Content-Type', ct);
}

function upstreamErrorJson(res, upstream, rawText) {
  const peek = String(rawText || '').trim().slice(0, 300).replace(/\s+/g, ' ');
  return res
    .status(upstream.status)
    .json({ ok: false, error: `Upstream ${upstream.status}`, body: peek });
}

function buildTargetUrl(base, req) {
  const url = new URL(base);
  for (const [k, v] of Object.entries(req.query || {})) {
    if (k === 'base') continue; // nooit doorgeven
    if (v != null) url.searchParams.set(k, String(v));
  }
  // lichte cache-bust, kan je schrappen als ongewenst
  url.searchParams.set('t', Date.now().toString());
  return url.toString();
}

// ───────────────────────── Routes ─────────────────────────
// GET /api/sheets?mode=... | action=...
router.get('/', async (req, res) => {
  try {
    const base = resolveBase(req);
    if (!base) {
      return res.status(500).json({ ok: false, error: 'SUPERHOND_API_BASE ontbreekt (of onveilige base override).' });
    }

    const target = buildTargetUrl(base, req);
    const upstream = await fetchWithTimeout(target, { method: 'GET' }, TIMEOUT_MS);
    const text = await upstream.text();

    // Als upstream JSON aangeeft → geef status + body 1-op-1 door
    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      passThroughContentType(res, upstream);
      res.set('Cache-Control', 'no-store');
      return res.status(upstream.status).send(text);
    }

    // Upstream geen JSON → waarschijnlijk HTML (login/fout). Geef nette 502 terug.
    if (!upstream.ok || isHTML(text)) {
      return upstreamErrorJson(res, upstream, text);
    }

    // Probeer alsnog JSON te parsen
    try {
      const json = JSON.parse(text);
      res.set('Cache-Control', 'no-store');
      return res.status(upstream.status).json(json);
    } catch {
      return res.status(502).json({ ok: false, error: 'Upstream gaf ongeldige JSON' });
    }
  } catch (err) {
    const timeout = err?.name === 'AbortError' || err?.message === 'timeout';
    return res.status(timeout ? 504 : 502).json({ ok: false, error: timeout ? 'Timeout naar upstream' : String(err) });
  }
});

// POST /api/sheets  (body: text/plain of JSON, door naar GAS doPost)
router.post('/', async (req, res) => {
  try {
    const base = resolveBase(req);
    if (!base) {
      return res.status(500).json({ ok: false, error: 'SUPERHOND_API_BASE ontbreekt (of onveilige base override).' });
    }

    const target = buildTargetUrl(base, req);
    const isString = typeof req.body === 'string';
    const bodyText = isString ? req.body : JSON.stringify(req.body ?? {});
    const contentTypeHeader = isString
      ? (req.get('content-type') || 'text/plain; charset=utf-8')
      : 'application/json; charset=utf-8';

    const upstream = await fetchWithTimeout(
      target,
      { method: 'POST', headers: { 'Content-Type': contentTypeHeader }, body: bodyText },
      TIMEOUT_MS
    );
    const text = await upstream.text();

    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      passThroughContentType(res, upstream);
      res.set('Cache-Control', 'no-store');
      return res.status(upstream.status).send(text);
    }

    if (!upstream.ok || isHTML(text)) {
      return upstreamErrorJson(res, upstream, text);
    }

    try {
      const json = JSON.parse(text);
      res.set('Cache-Control', 'no-store');
      return res.status(upstream.status).json(json);
    } catch {
      return res.status(502).json({ ok: false, error: 'Upstream gaf ongeldige JSON' });
    }
  } catch (err) {
    const timeout = err?.name === 'AbortError' || err?.message === 'timeout';
    return res.status(timeout ? 504 : 502).json({ ok: false, error: timeout ? 'Timeout naar upstream' : String(err) });
  }
});

export default router;
