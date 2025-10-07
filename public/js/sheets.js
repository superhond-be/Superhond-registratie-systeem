/public/js/sheets.js
```js
// v0.23.0 — Sheets client (GAS /exec compatible + legacy ?sheet=…)
// - Werkt met BASE_URL op Google Apps Script /exec (mode=…)
// - Backwards compatible met endpoints die ?sheet=… verwachten
// - Caching met TTL, retries met exponential backoff, HTML-detectie
// - Exports: setBaseUrl, clearCache, normStatus, validateSheet, fetchSheet

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_TTL_MS = 60_000;
const MAX_RETRIES = 2;

let BASE_URL = "";           // gezet via setBaseUrl()
let cache = new Map();       // key -> { expires, data }

// ---------------- Utils ----------------
function strip(s) { return String(s ?? "").replace(/^\uFEFF/, "").trim(); }
function isHTML(txt) { return /^\s*</.test(strip(txt)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function toQuery(params) { return "?" + new URLSearchParams(params).toString(); }

function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout na ${ms}ms`)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); },
                 e => { clearTimeout(t); reject(e); });
  });
}

function cacheKey(sheet) { return `${BASE_URL}::${sheet}`; }
function setCache(key, data, ttl = DEFAULT_TTL_MS) { cache.set(key, { expires: Date.now() + ttl, data }); }
function getCache(key) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  cache.delete(key);
  return null;
}

// ---------------- Public API ----------------
export function setBaseUrl(url) {
  if (!url || typeof url !== "string") throw new Error("setBaseUrl: geen geldige URL");
  BASE_URL = url.replace(/\/$/, "");
}

export function clearCache() { cache.clear(); }

// Normaliseer statusveld
export function normStatus(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "";
  if (["actief", "active", "1", "true", "ja"].includes(s)) return "actief";
  if (["inactief", "inactive", "0", "false", "nee"].includes(s)) return "inactief";
  return s;
}

// Validatie van ontvangen tabblad-data
export function validateSheet(name, items, requiredCols = []) {
  const messages = [];
  if (!Array.isArray(items) || items.length === 0) {
    messages.push(`⚠️ Geen rijen gevonden in tabblad ${name}`);
    return messages;
  }
  const first = items[0] || {};
  for (const col of requiredCols) {
    if (!(col in first)) messages.push(`⚠️ Kolom '${col}' ontbreekt in ${name}`);
  }
  const emptyCells = [];
  for (const [i, row] of items.entries()) {
    for (const col of requiredCols) {
      if (col in row && (row[col] === "" || row[col] == null)) {
        emptyCells.push(`${col} (rij ${i + 2})`);
      }
    }
  }
  if (emptyCells.length) {
    messages.push(
      `⚠️ Lege waarden in ${name}: ` +
      `${emptyCells.slice(0, 5).join(", ")}${emptyCells.length > 5 ? " …" : ""}`
    );
  }
  if (messages.length === 0) messages.push(`✅ ${name} ok`);
  return messages;
}

// ---------------- Core fetch helpers ----------------
function isExecUrl(u) {
  try {
    const url = new URL(String(u || ""));
    return url.hostname === "script.google.com" &&
           url.pathname.startsWith("/macros/s/") &&
           url.pathname.endsWith("/exec");
  } catch { return false; }
}

function mapSheetToMode(sheetName) {
  const s = String(sheetName || "").trim().toLowerCase();
  // simpele mapping; pas uit indien tabnamen wijzigen
  const map = {
    "klassen": "klassen",
    "lessen": "lessen",
    "lessenreeks": "reeksen",
    "lessenreeksen": "reeksen",
    "reeksen": "reeksen",
    "klanten": "klanten",
    "honden": "honden",
  };
  return map[s] || s;
}

async function doFetchOnce(url) {
  const res = await withTimeout(fetch(url, { method: "GET", mode: "cors", credentials: "omit", cache: "no-store" }));
  const text = await res.text();

  if (!res.ok) {
    // geef stukje response mee voor debug
    const peek = strip(text).slice(0, 160).replace(/\s+/g, " ");
    throw new Error(`HTTP ${res.status}${peek ? ` — ${peek}` : ""}`);
  }

  if (isHTML(text)) {
    throw new Error("Ontvangen HTML i.p.v. JSON (login/CORS/proxy issue?)");
  }

  let json;
  try { json = JSON.parse(strip(text)); }
  catch { throw new Error("Ongeldige JSON van server"); }

  return json;
}

async function doFetchWithRetry(url) {
  let attempt = 0, lastErr;
  while (attempt <= MAX_RETRIES) {
    try {
      return await doFetchOnce(url);
    } catch (e) {
      lastErr = e;
      // netwerkachtige fouten of timeout → retry met backoff
      const msg = String(e?.message || "");
      const shouldRetry =
        /timeout/i.test(msg) ||
        /network/i.test(msg) ||
        /failed|abort|aborted/i.test(msg) ||
        /html/i.test(msg); // soms tijdelijke loginpagina op mobiel
      if (!shouldRetry || attempt === MAX_RETRIES) break;
      const backoff = 300 * Math.pow(2, attempt); // 300ms, 600ms, 1200ms
      await sleep(backoff);
      attempt++;
    }
  }
  throw lastErr || new Error("Fetch faalde");
}

// Stel de mogelijke routes samen op basis van BASE_URL en sheetName
function buildRoutes(sheetName, opts = {}) {
  const routes = [];
  const bust = opts.bust ? Date.now() : "";

  if (!BASE_URL) return routes;

  if (isExecUrl(BASE_URL)) {
    // GAS /exec variant (aanbevolen)
    const mode = mapSheetToMode(sheetName);
    routes.push(BASE_URL + toQuery({ mode, t: bust }));
  }

  // Legacy/alternatief: custom endpoint dat ?sheet=… verwacht
  routes.push(BASE_URL + toQuery({ sheet: sheetName, t: bust }));

  // Als BASE_URL NIET exec is, maar er draait een server-proxy (optioneel)
  // kun je ook nog proberen op /api/sheets
  try {
    const here = new URL(location.href);
    routes.push(here.origin + "/api/sheets" + toQuery({ mode: mapSheetToMode(sheetName), t: bust }));
  } catch { /* ignore */ }

  // Unieke routes (verwijder duplicaten)
  return [...new Set(routes)];
}

function normalizeItemsFromResponse(json) {
  // Ondersteun verschillende vormen:
  // 1) { ok:true, items:[...] }
  // 2) { items:[...] }
  // 3) Array direct: [...]
  // 4) RESP wrapper: { ok:true, data:{ items:[...] } } of { ok:true, data:[...] }
  let items = null;

  if (Array.isArray(json)) items = json;
  else if (json && Array.isArray(json.items)) items = json.items;
  else if (json && json.data && Array.isArray(json.data?.items)) items = json.data.items;
  else if (json && json.data && Array.isArray(json.data)) items = json.data;

  if (!items) throw new Error("Onverwacht antwoord: geen items-array");
  return items;
}

// ---------------- Main API ----------------
/**
 * Haal 1 tabblad op en geef array items terug.
 * @param {string} sheetName - bv. 'Klassen', 'Reeksen'
 * @param {object} opts - { ttlMs?: number, bust?: boolean }
 */
export async function fetchSheet(sheetName, opts = {}) {
  if (!BASE_URL) throw new Error("Base URL niet ingesteld");

  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const key = cacheKey(sheetName);

  if (!opts.bust) {
    const hit = getCache(key);
    if (hit) return hit.items;
  }

  const routes = buildRoutes(sheetName, opts);
  if (!routes.length) throw new Error("Geen routes beschikbaar (BASE_URL ontbreekt)");

  let lastErr;
  for (const url of routes) {
    try {
      const json = await doFetchWithRetry(url);
      // als server {ok:false,error} terugstuurt, gooi door
      if (json && json.ok === false) throw new Error(json.error || "Server gaf ok=false");
      const items = normalizeItemsFromResponse(json).map(r => ({ ...r, status: normStatus(r.status) }));
      setCache(key, { items }, ttl);
      return items;
    } catch (e) {
      lastErr = e;
      // probeer volgende route
    }
  }

  throw lastErr || new Error("Kon sheet niet laden");
}
