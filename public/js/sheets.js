// /js/sheets.js
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_TTL_MS = 60_000;
const MAX_RETRIES = 2;

<button class="btn" id="btn-recheck">Controle opnieuw uitvoeren</button>

let BASE_URL = "";
let cache = new Map();

export function setBaseUrl(url) {
  if (!url || typeof url !== "string") throw new Error("setBaseUrl: geen geldige URL");
  BASE_URL = url.replace(/\/$/, "");
}

export function clearCache() { cache.clear(); }

export function normStatus(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "";
  if (["actief", "active", "1", "true", "ja"].includes(s)) return "actief";
  if (["inactief", "inactive", "0", "false", "nee"].includes(s)) return "inactief";
  return s;
}

// === Nieuw: controlefunctie ===
export function validateSheet(name, items, requiredCols = []) {
  const messages = [];
  if (!Array.isArray(items) || items.length === 0) {
    messages.push(`⚠️ Geen rijen gevonden in tabblad ${name}`);
    return messages;
  }

  // controleer kolomnamen
  const first = items[0];
  for (const col of requiredCols) {
    if (!(col in first)) messages.push(`⚠️ Kolom '${col}' ontbreekt in ${name}`);
  }

  // controleer lege waarden
  const emptyCells = [];
  for (const [i, row] of items.entries()) {
    for (const col of requiredCols) {
      if (col in row && (row[col] === "" || row[col] == null))
        emptyCells.push(`${col} (rij ${i + 2})`);
    }
  }
  if (emptyCells.length) {
    messages.push(`⚠️ Lege waarden in ${name}: ${emptyCells.slice(0, 5).join(", ")}${emptyCells.length > 5 ? " …" : ""}`);
  }

  if (messages.length === 0) messages.push(`✅ ${name} ok`);
  return messages;
}

// --- Data ophalen (ongewijzigd) ---
function toQuery(params) { return "?" + new URLSearchParams(params).toString(); }
function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout na ${ms}ms`)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
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

async function doFetch(url) {
  const res = await withTimeout(fetch(url, { method: "GET", mode: "cors", credentials: "omit" }));
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error("Ongeldige JSON van server"); }
  if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

/**
 * Haal 1 tabblad op en geef array items terug.
 */
export async function fetchSheet(sheetName, opts = {}) {
  if (!BASE_URL) throw new Error("Base URL niet ingesteld");
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const key = cacheKey(sheetName);
  if (!opts.bust) {
    const hit = getCache(key);
    if (hit) return hit.items;
  }

  const url = BASE_URL + toQuery({ sheet: sheetName, t: opts.bust ? Date.now() : "" });
  const json = await doFetch(url);
  if (!json.ok || !Array.isArray(json.items)) throw new Error("Onverwacht antwoord");
  const items = json.items.map(r => ({ ...r, status: normStatus(r.status) }));
  setCache(key, { items }, ttl);
  return items;
}
