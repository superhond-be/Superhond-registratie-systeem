/**
 * public/js/sheets.js — Proxy-first Sheets API met harde fallback (v0.26.0)
 * - Probeert eerst /api/sheets (optionele proxy), valt bij 404/timeout/netwerk terug op GAS /exec
 * - Centrale netstatus: succesvolle call => online; netwerk/timeout => offline; HTTP 4xx/5xx => online
 * - initFromConfig(): leest /api/config en localStorage('apiBase')
 * - fetchSheet(tab, { timeout, params, signal })
 * - fetchAction(action, { timeout, params, signal })
 * - postAction({ entity, action, payload })
 * - Helpers: saveKlant/Hond/Klas/Les, normStatus, currentApiBase
 */

const DEFAULT_TIMEOUT = 12000;
const HEAVY_TIMEOUT   = 20000;  // bv. 'Klanten'
const RETRIES         = 1;

let API_BASE = ''; // bv. https://script.google.com/macros/s/XXX/exec
let CFG      = {}; // { apiBase, version, env }

/* ───────────────────────── Netstatus helpers ───────────────────────── */
function noteOnline() {
  try {
    if (window.SuperhondNet?.setOnline) window.SuperhondNet.setOnline(true, { source: 'sheets' });
    else if (window.SuperhondUI?.setOnline) window.SuperhondUI.setOnline(true);
  } catch {}
}
function noteOffline() {
  try {
    if (window.SuperhondNet?.setOnline) window.SuperhondNet.setOnline(false, { source: 'sheets' });
    else if (window.SuperhondUI?.setOnline) window.SuperhondUI.setOnline(false);
  } catch {}
}
function isNetworkyError(e) {
  const m = String(e && e.message || '').toLowerCase();
  return m.includes('timeout') || m.includes('network') || m.includes('failed to fetch') || m.includes('abort');
}

/* ───────────────────────── Utils ───────────────────────── */
function withTimeout(ms, p) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);
}

function qs(obj = {}) {
  const s = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    s.set(k, String(v));
  });
  return s.toString();
}

async function getJSON(url, { timeout = DEFAULT_TIMEOUT, signal } = {}) {
  const res = await withTimeout(timeout, fetch(url, { cache: 'no-store', signal }));
  // Let op: we markeren ONLINE zelfs als er een HTTP-fout is (server bereikbaar)
  if (!res.ok) {
    noteOnline();
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  // Content-type kan ontbreken
  const ct = res.headers.get('content-type') || '';
  let data;
  if (!ct.includes('application/json')) {
    try { data = await res.json(); }
    catch { throw new Error(`Geen geldige JSON (status ${res.status})`); }
  } else {
    data = await res.json();
  }
  noteOnline();
  return data;
}

async function postJSON(url, body, { timeout = DEFAULT_TIMEOUT, signal } = {}) {
  const res = await withTimeout(timeout, fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
    signal
  }));
  if (!res.ok) {
    noteOnline();
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  noteOnline();
  return data;
}

/* ───────────────────────── Config ───────────────────────── */
export async function initFromConfig() {
  if (API_BASE) return API_BASE;
  // 1) /api/config (optioneel)
  try {
    const r = await getJSON('/api/config', { timeout: 4000 });
    CFG = r || {};
    if (r?.apiBase) API_BASE = r.apiBase;
  } catch (e) {
    // Bij config-fout niets doen; dit is geen harde offline indicatie
  }

  // 2) localStorage override
  const ls = localStorage.getItem('apiBase');
  if (ls) API_BASE = ls;

  return API_BASE;
}

export function currentApiBase() {
  return API_BASE || localStorage.getItem('apiBase') || '';
}

/* ───────────────────────── Kern: proxy-first + harde fallback ───────────────────────── */
async function proxyThenGas(urlProxy, urlGas, { timeout, signal } = {}) {
  // 1) Proxy proberen
  try {
    const data = await getJSON(urlProxy, { timeout, signal });
    return data;
  } catch (e) {
    // Als status NIET 404 is en geen netwerk/timeout, geef direct door (functionele fout)
    if (e && e.status && e.status !== 404) throw e;
    if (!e.status && !isNetworkyError(e)) throw e;
    // Anders: door naar GAS
  }

  if (!urlGas || !urlGas.startsWith('http')) {
    // Beide paden faalden of er is geen apiBase
    noteOffline();
    throw new Error('Proxy faalde (404/timeout) en geen geldige apiBase ingesteld.');
  }

  // 2) GAS direct
  const data2 = await getJSON(urlGas, { timeout, signal });
  return data2;
}

/* ───────────────────────── API: GET ───────────────────────── */
export async function fetchSheet(tab, { timeout, params = {}, signal } = {}) {
  await initFromConfig();
  const t = (tab === 'Klanten') ? (timeout || HEAVY_TIMEOUT) : (timeout || DEFAULT_TIMEOUT);

  const baseParams = { action: 'getSheet', tab, ...params, _: Date.now() };
  const q = qs(baseParams);

  const urlProxy = `/api/sheets?${q}`;
  const urlGas   = currentApiBase() ? `${currentApiBase()}?${q}` : '';

  let lastErr;
  for (let i = 0; i <= RETRIES; i++) {
    try {
      const data = await proxyThenGas(urlProxy, urlGas, { timeout: t, signal });
      noteOnline();
      return data;
    } catch (e) {
      lastErr = e;
      // Als laatste poging straks ook faalt, bepalen we hier de status
      if (i === RETRIES) {
        if (isNetworkyError(e)) noteOffline();
        else noteOnline(); // functionele fout: server bereikbaar
        break;
      }
    }
  }
  throw lastErr;
}

export async function fetchAction(action, { timeout, params = {}, signal } = {}) {
  await initFromConfig();
  const t = timeout || DEFAULT_TIMEOUT;

  const baseParams = { action, ...params, _: Date.now() };
  const q = qs(baseParams);

  const urlProxy = `/api/sheets?${q}`;
  const urlGas   = currentApiBase() ? `${currentApiBase()}?${q}` : '';

  try {
    const data = await proxyThenGas(urlProxy, urlGas, { timeout: t, signal });
    noteOnline();
    return data;
  } catch (e) {
    if (isNetworkyError(e)) noteOffline();
    else noteOnline();
    throw e;
  }
}

/* ───────────────────────── API: POST ───────────────────────── */
export async function postAction({ entity, action, payload }, { timeout, signal } = {}) {
  await initFromConfig();
  const t = timeout || DEFAULT_TIMEOUT;

  const body = { entity, action, payload };
  const urlProxy = `/api/sheets`;
  const urlGas   = currentApiBase();

  // 1) Proxy
  try {
    const data = await postJSON(urlProxy, body, { timeout: t, signal });
    noteOnline();
    return data;
  } catch (e) {
    // functionele fout ≠ offline
    if (e && e.status && e.status !== 404) { noteOnline(); throw e; }
    if (!e.status && !isNetworkyError(e)) { noteOnline(); throw e; }
  }

  // 2) GAS
  if (!urlGas) {
    noteOffline();
    throw new Error('Proxy faalde en apiBase is niet ingesteld.');
  }

  try {
    const data = await postJSON(urlGas, body, { timeout: t, signal });
    noteOnline();
    return data;
  } catch (e) {
    if (isNetworkyError(e)) noteOffline(); else noteOnline();
    throw e;
  }
}

/* ───────────────────────── Helpers voor entiteiten ───────────────────────── */
export const saveKlant = (payload, opts) => postAction({ entity: 'klant', action: payload?.id ? 'update' : 'add', payload }, opts);
export const saveHond  = (payload, opts) => postAction({ entity: 'hond',  action: payload?.id ? 'update' : 'add', payload }, opts);
export const saveKlas  = (payload, opts) => postAction({ entity: 'klas',  action: payload?.id ? 'update' : 'add', payload }, opts);
export const saveLes   = (payload, opts) => postAction({ entity: 'les',   action: payload?.id ? 'update' : 'add', payload }, opts);

/* ───────────────────────── Kleine normalisaties ───────────────────────── */
export function normStatus(s) {
  const v = String(s || '').trim().toLowerCase();
  if (!v) return '';
  if (['actief', 'active', 'activeer', 'activer', '1', 'yes', 'ja', 'true'].includes(v)) return 'actief';
  if (['inactief', 'inactive', '0', 'nee', 'no', 'false', 'archief', 'archiveren', 'archived'].includes(v)) return 'inactief';
  return s; // onbekend: laat origineel staan
}

/* ───────────────────────── Debug export (optioneel) ───────────────────────── */
export function _getConfig() { return { API_BASE, CFG }; }
