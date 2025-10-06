// /public/klassen/index.js
// v0.22.2 — Klassenlijst: laden (seed + local), zoeken, bewerken/verwijderen
// - Optionele integratie met /public/js/store.js (get/set/ensureMigrated)
// - Fallback op localStorage bucket: superhond-db.klassen

// ---------- kleine helpers ----------
const $  = (s) => document.querySelector(s);
const S  = (v) => String(v ?? '').trim();
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

function escapeHTML(s = '') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function debounce(fn, ms = 150) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ---------- DOM ----------
const els = {
  loader: $('#loader'),
  error:  $('#error'),
  wrap:   $('#wrap'),
  tbody:  $('#tabelBody'),
  zoek:   $('#zoek'),
  counter: $('#count') // optioneel <small id="count">
};

// topbar/footer
document.addEventListener('DOMContentLoaded', () => {
  if (window.SuperhondUI?.mount) {
    window.SuperhondUI.mount({ title: 'Klassen', icon: '📚', back: '../dashboard/', showApiStatus: false });
  }
});

// ---------- opslag (fallback + optionele store.js) ----------
const LS_KEY = 'superhond-db';
function loadDB() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const db  = raw ? JSON.parse(raw) : {};
    if (!Array.isArray(db.klassen)) db.klassen = [];
    return db;
  } catch {
    return { klassen: [] };
  }
}
function saveDB(db) { localStorage.setItem(LS_KEY, JSON.stringify(db)); }
function getKlassenLS() { return loadDB().klassen; }
function setKlassenLS(arr) { const db = loadDB(); db.klassen = Array.isArray(arr) ? arr : []; saveDB(db); }

let store = {
  getKlassen: getKlassenLS,
  setKlassen: setKlassenLS,
  ensureMigrated: async () => {}
};

// probeer dynamisch /js/store.js (optioneel)
(async () => {
  try {
    const m = await import('../js/store.js');
    store.getKlassen = m.getKlassen || getKlassenLS;
    store.setKlassen = m.setKlassen || setKlassenLS;
    store.ensureMigrated = m.ensureMigrated || (async () => {});
  } catch { /* geen store.js → fallback blijft */ }
})();

// ---------- data helpers ----------
async function fetchJson(candidates) {
  for (const base of candidates) {
    try {
      const url = base + (base.includes('?') ? '&' : '?') + 't=' + Date.now();
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      return await r.json();
    } catch { /* volgende proberen */ }
  }
  return null;
}

// normalisatie naar uniforme vorm
function normalizeKlassen(raw) {
  const arr =
    Array.isArray(raw)            ? raw :
    Array.isArray(raw?.klassen)   ? raw.klassen :
    Array.isArray(raw?.items)     ? raw.items :
    Array.isArray(raw?.data)      ? raw.data : [];

  return arr.map(k => ({
    id:               k.id ?? k.klasId ?? k.classId ?? null,
    naam:             S(k.naam || k.name || ''),
    type:             S(k.type || k.subnaam || ''),
    thema:            S(k.thema || k.theme || ''),
    strippen:         Number(k.strippen ?? k.aantal_strippen ?? k.strips ?? 0) || 0,
    geldigheid_weken: Number(k.geldigheid_weken ?? k.geldigheid ?? k.weken ?? 0) || 0,
    status:           (S(k.status || '').toLowerCase() || 'actief')
  }));
}

// merge op id (of naam fallback) — lokaal overschrijft seed
function mergeById(localRows = [], extRows = []) {
  const key = (x) => S(x.id) || `__name__${S(x.naam)}`;
  const map = new Map(extRows.map(x => [key(x), x]));
  for (const loc of localRows) map.set(key(loc), loc);
  return [...map.values()];
}

// ---------- render ----------
let ALL_ROWS = [];

function statusBadge(s) {
  const t = (s || '').toLowerCase();
  if (t === 'inactief') return '<span class="badge" style="background:#fee2e2;color:#991b1b">inactief</span>';
  return '<span class="badge" style="background:#ecfdf5;color:#065f46">actief</span>';
}

function rowHTML(r) {
  const idEnc = r.id ? encodeURIComponent(r.id) : '';
  const nameContent = r.id
    ? `<a href="./detail.html?id=${idEnc}"><strong>${escapeHTML(r.naam || '(zonder naam)')}</strong></a>`
    : `<strong>${escapeHTML(r.naam || '(zonder naam)')}</strong>`;

  return `
    <tr data-id="${r.id ? String(r.id).replaceAll('"','&quot;') : ''}">
      <td>${nameContent}</td>
      <td>${escapeHTML(r.type || '—')}</td>
      <td>${escapeHTML(r.thema || '—')}</td>
      <td>${r.strippen || 0}</td>
      <td>${r.geldigheid_weken || 0} w</td>
      <td>${statusBadge(r.status)}</td>
      <td style="white-space:nowrap">
        ${r.id ? `
          <a class="btn btn-xs" href="./detail.html?id=${idEnc}" title="Bekijken">👁️</a>
          <a class="btn btn-xs" href="./nieuw.html?id=${idEnc}" title="Bewerken">✏️</a>
          <button class="btn btn-xs" data-action="delete" data-id="${escapeHTML(r.id)}" title="Verwijderen">🗑️</button>
        ` : ''}
      </td>
    </tr>
  `;
}

function render(rows) {
  ALL_ROWS = rows.slice();
  if (!rows.length) {
    els.tbody.innerHTML = `<tr><td colspan="7" class="muted">Geen klassen gevonden.</td></tr>`;
    els.wrap.style.display = '';
    if (els.counter) els.counter.textContent = '0';
    return;
  }
  els.tbody.innerHTML = rows.map(rowHTML).join('');
  els.wrap.style.display = '';
  if (els.counter) els.counter.textContent = String(rows.length);
}

function applySearch(all) {
  const q = S(els.zoek?.value).toLowerCase();
  if (!q) return all;
  return all.filter(r =>
    (r.naam || '').toLowerCase().includes(q) ||
    (r.type || '').toLowerCase().includes(q) ||
    (r.thema || '').toLowerCase().includes(q)
  );
}

function bindActions() {
  on(els.tbody, 'click', (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (!id) return;

    if (!confirm('Deze klas verwijderen?')) return;

    // verwijder uit opslag
    const items = store.getKlassen();
    const next = items.filter(k => String(k.id) !== String(id));
    store.setKlassen(next);

    // verwijder uit view
    const newRows = ALL_ROWS.filter(r => String(r.id) !== String(id));
    render(applySearch(newRows));
  });

  // zoeken (debounced)
  on(els.zoek, 'input', debounce(() => render(applySearch(ALL_ROWS)), 120));
}

// ---------- init ----------
async function init() {
  try {
    els.loader && (els.loader.style.display = '');
    els.error  && (els.error.style.display  = 'none');
    els.wrap   && (els.wrap.style.display   = 'none');

    await store.ensureMigrated();

    const [extRaw] = await Promise.all([
      fetchJson(['../data/klassen.json', '/data/klassen.json'])
    ]);

    const extRows = normalizeKlassen(extRaw);
    const locRows = normalizeKlassen({ klassen: store.getKlassen() });

    const merged = mergeById(locRows, extRows)
      .sort((a,b) => String(a.naam).localeCompare(String(b.naam)));

    render(merged);
    bindActions();

    els.loader && (els.loader.style.display = 'none');
  } catch (e) {
    console.error('[klassen/index] load error:', e);
    if (els.loader) els.loader.style.display = 'none';
    if (els.error) {
      els.error.style.display = '';
      els.error.textContent = '⚠️ Kon klassen niet laden. ' + (e?.message || e);
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
