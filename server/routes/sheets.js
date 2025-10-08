// server/routes/sheets.js — Proxy naar Google Apps Script (GAS)
// .env: GAS_BASE_URL = https://script.google.com/macros/s/AKfycbw.../exec
import { Router } from 'express';

const router = Router();
const GAS_BASE_URL = process.env.GAS_BASE_URL?.trim();

if (!GAS_BASE_URL) {
  console.warn('[sheets] GAS_BASE_URL ontbreekt. /api/sheets zal 500 teruggeven.');
}

// Kleine helper: fetch met timeout/abort
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal, redirect: 'follow' });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function passThroughContentType(res, upRes) {
  const ct = upRes.headers.get('content-type');
  if (ct) res.set('Content-Type', ct);
}

// ────────────────────────────────────────────────────────────────────────────────
// GET → proxy naar GAS (bv. ?action=getLeden)
// Mounting in index.js: app.use('/api/sheets', router)
// ⇒ hier dus pad '/' gebruiken, niet '/api/sheets'
// ────────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    if (!GAS_BASE_URL) {
      return res.status(500).json({ ok: false, error: 'GAS_BASE_URL ontbreekt op de server' });
    }
    const qs = new URLSearchParams(req.query).toString();
    const target = `${GAS_BASE_URL}${qs ? `?${qs}` : ''}`;

    const upstream = await fetchWithTimeout(target, {}, 10000);
    const text = await upstream.text();

    passThroughContentType(res, upstream);
    res.set('Cache-Control', 'no-store');
    return res.status(upstream.status).send(text);
  } catch (err) {
    const aborted = err && err.name === 'AbortError';
    console.error('❌ [sheets:get] Proxy-fout:', err);
    return res
      .status(aborted ? 504 : 502)
      .json({ ok: false, error: aborted ? 'GAS timeout' : 'Proxy-fout', detail: String(err) });
  }
});

// ────────────────────────────────────────────────────────────────────────────────
/* POST → proxy naar GAS
   - Accepteert zowel JSON bodies (object) als text/plain (string)
   - In index.js staat:
       app.use('/api/sheets', express.text({ type: '*/*', limit: '1mb' }));
     Dus req.body kan een string zijn. Vangen we hier op. */
// ────────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    if (!GAS_BASE_URL) {
      return res.status(500).json({ ok: false, error: 'GAS_BASE_URL ontbreekt op de server' });
    }

    const isString = typeof req.body === 'string';
    const body = isString ? req.body : JSON.stringify(req.body ?? {});
    const contentTypeHeader =
      isString
        ? (req.get('content-type') || 'text/plain; charset=utf-8')
        : 'application/json; charset=utf-8';

    const upstream = await fetchWithTimeout(GAS_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': contentTypeHeader },
      body
    }, 10000);

    const text = await upstream.text();
    passThroughContentType(res, upstream);
    res.set('Cache-Control', 'no-store');
    return res.status(upstream.status).send(text);
  } catch (err) {
    const aborted = err && err.name === 'AbortError';
    console.error('❌ [sheets:post] Proxy-fout:', err);
    return res
      .status(aborted ? 504 : 502)
      .json({ ok: false, error: aborted ? 'GAS timeout' : 'Proxy-fout', detail: String(err) });
  }
});

export default router;
