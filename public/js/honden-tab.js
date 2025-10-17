import {
  initFromConfig,
  fetchSheet,
  saveHond
} from './sheets.js';

const $ = (s, r = document) => r.querySelector(s);
const TIMEOUT_MS = 20000;
const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

let allRows = [];
let viewRows = [];
let lastAbort = null;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function fmtDate(iso) {
  const s = String(iso || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function normalize(row) {
  const o = {};
  for (const [k, v] of Object.entries(row || {})) {
    o[String(k || '').toLowerCase()] = v;
  }
  return {
    id:        (o.id ?? o.hondid ?? '').toString(),
    name:      (o.name ?? '').toString(),
    breed:     (o.breed ?? '').toString(),
    birthdate: (o.birthdate ?? '').toString(),
    ownerid:   (o.ownerid ?? '').toString(),
    chip:      (o.chip ?? '').toString(),
    notes:     (o.notes ?? '').toString(),
    status:    (o.status ?? '').toString(),
  };
}

function rowMatches(r, q) {
  if (!q) return true;
  const hay = [r.name, r.breed, r.ownerid, r.chip, r.notes, r.status]
    .map(x => String(x || '').toLowerCase())
    .join(' ');
  return hay.includes(q);
}

function setState(t, k = 'muted') {
  const el = $('#state-hond');
  if (!el) return;
  el.className = k;
  el.textContent = t;
  el.setAttribute('role', k === 'error' ? 'alert' : 'status');
}

function render(rows) {
  const tb = $('#tbl-hond tbody');
  if (!tb) return;
  tb.innerHTML = '';
  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="5" class="muted">Geen resultaten.</td></tr>`;
    return;
  }
  const frag = document.createDocumentFragment();
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.breed)}</td>
      <td>${escapeHtml(fmtDate(r.birthdate))}</td>
      <td>${escapeHtml(r.ownerid)}</td>
      <td class="nowrap">
        <button class="btn btn-xs act-edit" data-id="${escapeHtml(r.id)}">✏️</button>
        <button class="btn btn-xs danger act-del" data-id="${escapeHtml(r.id)}">🗑️</button>
      </td>`;
    frag.appendChild(tr);
  }
  tb.appendChild(frag);
}

function doFilter() {
  const q = String($('#search-hond')?.value || '').trim().toLowerCase();
  viewRows = allRows.filter(r => rowMatches(r, q));
  render(viewRows);
}

async function refresh() {
  if (lastAbort) lastAbort.abort();
  const ac = new AbortController();
  lastAbort = ac;
  const t = setTimeout(() => ac.abort(new Error('timeout')), TIMEOUT_MS);

  try {
    setState('⏳ Laden…');
    const raw = await fetchSheet('Honden', { signal: ac.signal, timeout: TIMEOUT_MS });
    const rows = Array.isArray(raw?.data) ? raw.data : [];
    allRows = rows.map(normalize).sort((a, b) => collator.compare(a.name, b.name));
    doFilter();
    setState(`✅ ${viewRows.length} geladen`);
  } catch (e) {
    if (e?.name !== 'AbortError') {
      console.error('[honden-tab] fout:', e);
      setState('❌ Laden mislukt: ' + (e?.message || e), 'error');
    }
  } finally {
    clearTimeout(t);
  }
}

async function onSubmit(e) {
  e.preventDefault();
  const f = e.currentTarget;
  const fd = new FormData(f);

  const payload = {
    name:      fd.get('name')?.trim(),
    breed:     fd.get('breed')?.trim(),
    birthdate: fd.get('birthdate')?.trim(),
    ownerId:   fd.get('ownerId')?.trim(),
    chip:      fd.get('chip')?.trim(),
    notes:     fd.get('notes')?.trim(),
    status:    fd.get('status')?.trim() || 'actief'
  };

  const msg = $('#form-msg-hond');
  if (!payload.name || !payload.ownerId) {
    msg.textContent = '❌ Naam en eigenaar zijn verplicht';
    msg.className = 'error';
    return;
  }

  msg.textContent = '⏳ Opslaan…';
  msg.className = 'muted';

  try {
    const result = await saveHond(payload);
    allRows.push(normalize({ id: result?.id || '', ...payload }));
    allRows.sort((a, b) => collator.compare(a.name, b.name));
    doFilter();
    f.reset();
    msg.textContent = '✅ Hond toegevoegd';
  } catch (err) {
    console.error('[honden-tab] opslaan fout:', err);
    msg.textContent = '❌ Opslaan mislukt: ' + (err?.message || err);
    msg.className = 'error';
  }
}

export async function initHondenTab() {
  await initFromConfig();

  $('#search-hond')?.addEventListener('input', doFilter);
  $('#refresh-hond')?.addEventListener('click', refresh);
  $('#form-add-hond')?.addEventListener('submit', onSubmit);

  await refresh();
}
