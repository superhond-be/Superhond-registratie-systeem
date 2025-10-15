/**
 * public/js/sheets.js — Centrale API laag (v0.27.1)
 * - Rechtstreeks naar Google Apps Script /exec
 * - Base uit: window.SUPERHOND_SHEETS_URL → meta[name=superhond-exec] → localStorage(superhond:apiBase)
 * - fetchSheet('Klanten'|'Honden'|...), fetchAction('getLessen'|...), postAction(entity,action,payload)
 * - saveKlant/saveHond helpers (legacy)
 */

const LS_API = 'superhond:apiBase';
const DEFAULT_TIMEOUT = 20000;

function resolveBase() {
  if (typeof window.SUPERHOND_SHEETS_URL === 'string' && window.SUPERHOND_SHEETS_URL) {
    return window.SUPERHOND_SHEETS_URL;
  }
  const meta = document.querySelector('meta[name="superhond-exec"]');
  if (meta?.content) return meta.content.trim();
  try {
    const ls = localStorage.getItem(LS_API);
    if (ls) return ls.trim();
  } catch {}
  return '';
}

/** Optioneel: expliciet instellen (en bewaren) */
export function setBaseUrl(url) {
  const s = String(url || '').trim();
  if (!s) return;
  try { localStorage.setItem(LS_API, s); } catch {}
}

/** Lezen voor debug */
export function getBaseUrl() {
  return resolveBase();
}

/** GET helper met timeout */
async function getJSON(paramsObj = {}, { timeout = DEFAULT_TIMEOUT } = {}) {
  const base = resolveBase();
  if (!base) throw new Error('Geen GAS /exec URL gevonden');
  const u = new URL(base);
  Object.entries(paramsObj).forEach(([k, v]) => {
    if (v != null && v !== '') u.searchParams.set(k, String(v));
  });
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(new Error('timeout')), timeout);
  try {
    const r = await fetch(u.toString(), { cache: 'no-store', signal: ac.signal });
    const tx = await r.text();
    let json;
    try { json = JSON.parse(tx); } catch { throw new Error(`Geen geldige JSON (HTTP ${r.status})`); }
    if (!r.ok || json?.ok === false) {
      throw new Error(json?.error || `HTTP ${r.status}`);
    }
    return json;
  } finally {
    clearTimeout(to);
  }
}

/** POST helper (text/plain om preflight te vermijden) */
async function postJSON(body = {}, { timeout = DEFAULT_TIMEOUT } = {}) {
  const base = resolveBase();
  if (!base) throw new Error('Geen GAS /exec URL gevonden');
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(new Error('timeout')), timeout);
  try {
    const r = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: ac.signal
    });
    const tx = await r.text();
    let json;
    try { json = JSON.parse(tx); } catch { throw new Error(`Geen geldige JSON (HTTP ${r.status})`); }
    if (!r.ok || json?.ok === false) {
      throw new Error(json?.error || `HTTP ${r.status}`);
    }
    return json;
  } finally {
    clearTimeout(to);
  }
}

/** Legacy tabloader: ondersteunt ?mode=klanten|honden|... en ?sheet=Klanten */
export async function fetchSheet(tabName, opts = {}) {
  const mode = String(tabName || '').trim();
  if (!mode) throw new Error('tabName vereist');
  // Probeer eerst ?mode=..., anders ?sheet=...
  try {
    const j = await getJSON({ mode }, opts);
    return j?.data || j;
  } catch {
    const j2 = await getJSON({ sheet: tabName }, opts);
    return j2?.data || j2;
  }
}

/** Moderne GET-actie */
export async function fetchAction(action, params = {}, opts = {}) {
  const a = String(action || '').trim();
  if (!a) throw new Error('action vereist');
  const j = await getJSON({ action: a, ...params }, opts);
  return j?.data ?? j;
}

/** Moderne POST-actie */
export async function postAction(entity, action, payload = {}, opts = {}) {
  const e = String(entity || '').trim().toLowerCase();
  const a = String(action || '').trim().toLowerCase();
  if (!e || !a) throw new Error('entity en action vereist');
  const j = await postJSON({ entity: e, action: a, payload }, opts);
  return j?.data ?? j;
}

/** Legacy helpers voor toevoegen */
export const saveKlant = (data) => postJSON({ mode: 'saveKlant', ...data }).then(j => j.data || j);
export const saveHond  = (data) => postJSON({ mode: 'saveHond',  ...data }).then(j => j.data || j);

/** Optioneel init (hier enkel om compat te houden) */
export async function initFromConfig(){ /* geen /api meer nodig */ }
