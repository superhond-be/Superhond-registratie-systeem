// Minimal type helpers for clarity (JSDoc)
/**
 * @typedef {{ id: string|number, naam: string, email: string, telefoon?: string, status?: 'actief'|'inactief'|'proef'|string, aangemaakt?: string|number|Date }} Klant
 */

const state = {
  klanten: /** @type {Klant[]} */([]),
  filtered: /** @type {Klant[]} */([]),
  page: 1,
  pageSize: 25,
  sort: /** @type {{key: keyof Klant, dir: 1|-1}|null} */(null),
  aborter: null /** @type {AbortController|null} */
};

// DOM refs
const tbody = document.querySelector('#tableBody');
const skeleton = document.querySelector('#skeleton');
const emptyState = document.querySelector('#emptyState');
const errorState = document.querySelector('#errorState');
const errorDetails = document.querySelector('#errorDetails');
const retryBtn = document.querySelector('#retryBtn');
const pageInfo = document.querySelector('#pageInfo');
const prevPage = document.querySelector('#prevPage');
const nextPage = document.querySelector('#nextPage');
const pageSizeSel = document.querySelector('#pageSize');
const searchInput = document.querySelector('#searchInput');
const rowTpl = /** @type {HTMLTemplateElement} */(document.querySelector('#rowTemplate'));

initThemeToggle();
boot();

function boot() {
  bindSorting();
  bindPagination();
  bindSearch();
  fetchKlanten();
}

// THEME TOGGLE ================================================================
function initThemeToggle() {
  const btn = /** @type {HTMLButtonElement} */(document.getElementById('themeToggle'));

  const icons = {
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.76 4.84l-1.8-1.79L3.17 4.85l1.79 1.79 1.8-1.8zM1 10.5h3v3H1v-3zm10.5-9h-3v3h3v-3zM4.84 17.24l-1.8 1.8 1.79 1.79 1.8-1.8-1.79-1.79zM10.5 20h3v3h-3v-3zm9-9h3v3h-3v-3zM19.16 4.84l-1.79-1.79-1.8 1.8 1.79 1.79 1.8-1.8zM17.24 19.16l1.79 1.79 1.8-1.8-1.79-1.79-1.8 1.8zM12 7.5A4.5 4.5 0 1 1 7.5 12 4.505 4.505 0 0 1 12 7.5z"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.01 2c-1.07 0-2.1.17-3.06.5 5.24 1.77 8.07 7.48 6.3 12.72-1.12 3.32-3.87 5.86-7.29 6.68A10 10 0 1 0 12.01 2z"/></svg>'
  };

  const stored = localStorage.getItem('theme'); // 'light'|'dark'|null
  const root = document.documentElement;

  const apply = (mode) => {
    if (mode === 'light' || mode === 'dark') {
      root.setAttribute('data-theme', mode);
    } else {
      root.setAttribute('data-theme', 'auto');
    }
    btn.innerHTML = prefersDark() && mode !== 'light' ? icons.sun : icons.moon;
    btn.title = `Schakel naar ${isDark() ? 'licht' : 'donker'} thema`;
    btn.setAttribute('aria-label', `Thema wisselen, nu ${isDark() ? 'donker' : 'licht'}`);
  };

  const prefersDark = () =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  const isDark = () => {
    const attr = root.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    return prefersDark();
  };

  apply(stored ?? 'auto');

  btn.addEventListener('click', () => {
    const current = root.getAttribute('data-theme'); // 'light'|'dark'|'auto'
    const next = current === 'light' ? 'dark' : current === 'dark' ? 'auto' : 'light';
    if (next === 'auto') localStorage.removeItem('theme');
    else localStorage.setItem('theme', next);
    apply(next);
  });

  // Live update if OS theme changes while in 'auto'
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', () => {
      if (!localStorage.getItem('theme')) apply('auto');
    });
  }
}

// DATA FETCH + RENDER =========================================================
async function fetchKlanten() {
  showSkeleton(true);
  showError(null);
  emptyState.classList.add('hidden');

  // Abort eerdere fetch indien nodig
  state.aborter?.abort();
  state.aborter = new AbortController();

  try {
    const res = await fetch('/api/klanten', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: state.aborter.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(()=>'');
      throw new Error(`HTTP ${res.status} — ${res.statusText}\n${text}`);
    }

    /** @type {unknown} */
    const json = await res.json();

    // Zachte validatie + normalisatie
    const arr = Array.isArray(json) ? json : (json?.data ?? []);
    state.klanten = arr.map(normalizeKlant).filter(Boolean);
    state.page = 1;
    applyFilterSortPaginate();
  } catch (err) {
    showError(err);
  } finally {
    showSkeleton(false);
  }
}

/** @returns {Klant} */
function normalizeKlant(k) {
  if (!k) return null;
  const naam = k.naam ?? k.name ?? `${k.voornaam ?? ''} ${k.achternaam ?? ''}`.trim();
  const email = k.email ?? k.mail ?? '';
  const telefoon = k.telefoon ?? k.phone ?? '';
  const status = (k.status ?? 'actief').toString().toLowerCase();
  const aangemaakt = k.aangemaakt ?? k.createdAt ?? k.created_at ?? k.created ?? Date.now();
  const id = k.id ?? k.uuid ?? cryptoRandomId();
  return { id, naam, email, telefoon, status, aangemaakt };
}

function cryptoRandomId() {
  // Fallback eenvoudige ID; prefer real API id
  const a = crypto?.getRandomValues?.(new Uint32Array(2)) ?? [Date.now(), Math.random()*1e9|0];
  return `tmp_${a[0].toString(16)}${a[1].toString(16)}`;
}

// SEARCH / SORT / PAGINATION ==================================================
function bindSearch() {
  const debounced = debounce(() => {
    state.page = 1;
    applyFilterSortPaginate();
  }, 180);
  searchInput.addEventListener('input', debounced);
}

function bindSorting() {
  document.querySelectorAll('th[data-sortable="true"]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-key');
      if (!key) return;
      if (state.sort?.key === key) {
        state.sort.dir = /** @type {1|-1} */(state.sort.dir * -1);
      } else {
        state.sort = { key, dir: 1 };
      }
      applyFilterSortPaginate();
      // visuele indicator
      document.querySelectorAll('th[data-sortable]').forEach(el => el.removeAttribute('data-sort'));
      th.setAttribute('data-sort', state.sort.dir === 1 ? 'asc' : 'desc');
    });
  });
}

function bindPagination() {
  prevPage.addEventListener('click', () => { if (state.page > 1) { state.page--; render(); }});
  nextPage.addEventListener('click', () => {
    const max = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
    if (state.page < max) { state.page++; render(); }
  });
  pageSizeSel.addEventListener('change', () => {
    state.pageSize = parseInt(pageSizeSel.value, 10) || 25;
    state.page = 1;
    render();
  });
}

function applyFilterSortPaginate() {
  const q = searchInput.value.trim().toLowerCase();
  state.filtered = !q ? [...state.klanten] : state.klanten.filter(k => {
    return [k.naam, k.email, k.telefoon].some(v => (v ?? '').toLowerCase().includes(q));
  });

  if (state.sort) {
    const { key, dir } = state.sort;
    state.filtered.sort((a, b) => {
      const av = a[key] ?? ''; const bv = b[key] ?? '';
      if (key === 'aangemaakt') {
        const ad = new Date(av).getTime() || 0;
        const bd = new Date(bv).getTime() || 0;
        return (ad - bd) * dir;
      }
      return String(av).localeCompare(String(bv), 'nl', { sensitivity: 'base' }) * dir;
    });
  }

  render();
}

// RENDER =====================================================================
function render() {
  // pagination
  const max = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
  state.page = Math.min(state.page, max);

  const start = (state.page - 1) * state.pageSize;
  const slice = state.filtered.slice(start, start + state.pageSize);

  tbody.innerHTML = '';
  const frag = document.createDocumentFragment();

  if (slice.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    for (const k of slice) {
      const node = rowTpl.content.cloneNode(true);
      node.querySelector('[data-col="naam"]').textContent = k.naam || '—';
      node.querySelector('[data-col="email"]').textContent = k.email || '—';
      node.querySelector('[data-col="telefoon"]').textContent = k.telefoon || '—';

      const badge = node.querySelector('[data-col="status"] .badge');
      const st = (k.status || '').toLowerCase();
      badge.textContent = st ? capitalize(st) : 'Onbekend';
      badge.style.background = statusColor(st).bg;
      badge.style.color = statusColor(st).fg;

      const dateCell = node.querySelector('[data-col="aangemaakt"]');
      dateCell.textContent = formatDate(k.aangemaakt);

      frag.appendChild(node);
    }
  }

  tbody.appendChild(frag);
  pageInfo.textContent = `Pagina ${state.page} van ${max} — ${state.filtered.length} resultaten`;
  prevPage.disabled = state.page <= 1;
  nextPage.disabled = state.page >= max;
}

function statusColor(st) {
  switch (st) {
    case 'actief':   return { bg: 'color-mix(in oklab, #22c55e 30%, var(--badge-bg))', fg: 'var(--badge-fg)' };
    case 'proef':    return { bg: 'color-mix(in oklab, #eab308 30%, var(--badge-bg))', fg: 'var(--badge-fg)' };
    case 'inactief': return { bg: 'color-mix(in oklab, #ef4444 25%, var(--badge-bg))', fg: 'var(--badge-fg)' };
    default:         return { bg: 'var(--badge-bg)', fg: 'var(--badge-fg)' };
  }
}

function formatDate(d) {
  const ts = new Date(d).getTime();
  if (!ts) return '—';
  return new Intl.DateTimeFormat('nl-BE', {
    year: 'numeric', month: 'short', day: '2-digit'
  }).format(ts);
}

function showSkeleton(on) {
  skeleton.classList.toggle('hidden', !on);
  document.querySelector('.data-table').classList.toggle('hidden', on);
  document.querySelector('.table-footer').classList.toggle('hidden', on);
}

function showError(err) {
  if (!err) {
    errorState.classList.add('hidden'); errorDetails.textContent = '';
    return;
  }
  errorState.classList.remove('hidden');
  errorDetails.textContent = (err?.stack || err?.message || String(err)).slice(0, 2000);
}
retryBtn.addEventListener('click', fetchKlanten);

// UTILS ======================================================================
function debounce(fn, ms = 200) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
