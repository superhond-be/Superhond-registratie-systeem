/**
 * klanten.js — Beheer van klanten voor Superhond
 * v0.27.7 – opgeschoond, enkel 'Klanten'-tabblad
 * © 2025 Superhond
 */

import {
  initFromConfig,
  fetchSheet,
  saveKlant
} from './sheets.js';

import { SuperhondUI } from './layout.js';

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

const TIMEOUT_MS = 20000;
const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

let allRows = [];
let viewRows = [];
let lastAbort = null;

/* ----------------------------------------------
 * Helpers
 * ---------------------------------------------- */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function setState(msg, cls = 'muted') {
  const el = $('#state');
  if (!el) return;
  el.className = cls;
  el.textContent = msg;
  el.setAttribute('role', cls === 'error' ? 'alert' : 'status');
}

function toArrayRows(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (Array.isArray(x.data)) return x.data;
  if (Array.isArray(x.rows)) return x.rows;
  if (x.result && Array.isArray(x.result)) return x.result;
  return [];
}

function normalize(row) {
  const o = {};
  for (const [k, v] of Object.entries(row || {})) {
    o[String(k || '').toLowerCase()] = v;
  }

  const id = (o.id ?? o.klantid ?? o['klant id'] ?? o['id.'] ?? '').toString();
  const vn = (o.voornaam || '').toString().trim();
  const an = (o.achternaam || '').toString().trim();
  const naam = (o.naam || `${vn} ${an}`.trim()).toString();

  return {
    id,
    voornaam: vn,
    achternaam: an,
    naam,
    email: (o.email || '').toString(),
    telefoon: (o.telefoon || o.gsm || '').toString(),
    status: (o.status || '').toString(),
  };
}

function rowMatches(r, q) {
  if (!q) return true;
  const hay = [r.naam, r.email, r.telefoon, r.status]
    .map(x => String(x || '').toLowerCase())
    .join(' ');
  return hay.includes(q);
}

/* ----------------------------------------------
 * Rendering
 * ---------------------------------------------- */

function render(rows) {
  const tb = $('#tbl tbody');
  if (!tb) return;
  tb.innerHTML = '';

  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="5" class="muted">Geen resultaten.</td></tr>`;
    return;
  }

  const frag = document.createDocumentFragment();
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.dataset.id = r.id || '';
    tr.innerHTML = `
      <td>${escapeHtml(r.naam || '')}</td>
      <td>${r.email ? `<a href="mailto:${escapeHtml(r.email)}">${escapeHtml(r.email)}</a>` : ''}</td>
      <td>${escapeHtml(r.telefoon || '')}</td>
      <td>${escapeHtml(r.status || '')}</td>
      <td class="nowrap">
        <button class="btn btn-xs act-edit" data-id="${escapeHtml(r.id)}" title="Wijzigen">✏️</button>
        <button class="btn btn-xs danger act-del" data-id="${escapeHtml(r.id)}" title="Verwijderen">🗑️</button>
      </td>`;
    frag.appendChild(tr);
  }
  tb.appendChild(frag);
}

/* ----------------------------------------------
 * Filtering + Refresh
 * ---------------------------------------------- */

function doFilter() {
  const q = String($('#search')?.value || '').trim().toLowerCase();
  viewRows = allRows.filter(r => rowMatches(r, q));
  render(viewRows);
}

async function refresh() {
  console.log('[klanten] refresh start');
  if (lastAbort) lastAbort.abort();
  const ac = new AbortController();
  lastAbort = ac;
  const t = setTimeout(() => ac.abort(new Error('timeout')), TIMEOUT_MS);

  try {
    setState('⏳ Laden…');

    console.log('[klanten] → fetchSheet("Klanten")');
    const raw = await fetchSheet('Klanten', { signal: ac.signal, timeout: TIMEOUT_MS });
    console.log('[klanten] ✅ Data ontvangen van "Klanten"');
    const rows = toArrayRows(raw);

    allRows = rows.map(normalize).sort((a, b) => collator.compare(a.naam || '', b.naam || ''));
    console.log(`[klanten] ${allRows.length} rijen genormaliseerd`);
    doFilter();

    setState(`✅ ${viewRows.length} klant${viewRows.length === 1 ? '' : 'en'} geladen`);
    SuperhondUI.setOnline(true);
  } catch (e) {
    if (e?.name === 'AbortError') {
      console.warn('[klanten] refresh geannuleerd');
      return;
    }
    console.error('[klanten] ❌ Laden mislukt:', e);
    setState('❌ Laden mislukt: ' + (e?.message || e), 'error');
    SuperhondUI.setOnline(false);
  } finally {
    clearTimeout(t);
  }
}

/* ----------------------------------------------
 * Nieuwe klant toevoegen
 * ---------------------------------------------- */

async function onSubmit(e) {
  e.preventDefault();
  const f = e.currentTarget;
  const fd = new FormData(f);
  const msg = $('#form-msg');

  const payload = {
    voornaam: fd.get('voornaam')?.trim() || '',
    achternaam: fd.get('achternaam')?.trim() || '',
    email: fd.get('email')?.trim() || '',
    telefoon: fd.get('telefoon')?.trim() || '',
    status: fd.get('status')?.trim() || 'actief',
  };

  if (!payload.voornaam || !payload.achternaam) {
    msg.className = 'error';
    msg.textContent = '❌ Voornaam en achternaam zijn verplicht.';
    return;
  }

  if (payload.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)) {
    msg.className = 'error';
    msg.textContent = '❌ Ongeldig e-mailadres.';
    return;
  }

  msg.className = 'muted';
  msg.textContent = '⏳ Opslaan…';

  try {
    const result = await saveKlant(payload);
    console.log('[klanten] ✅ Klant opgeslagen:', result);

    const id = result?.id || '';
    allRows.push(normalize({ id, naam: `${payload.voornaam} ${payload.achternaam}`.trim(), ...payload }));
    allRows.sort((a, b) => collator.compare(a.naam || '', b.naam || ''));
    doFilter();

    f.reset();
    msg.textContent = '✅ Klant toegevoegd';
  } catch (err) {
    console.error('[klanten] ❌ Opslaan mislukt:', err);
    msg.className = 'error';
    msg.textContent = '❌ Opslaan mislukt: ' + (err?.message || err);
  }
}

/* ----------------------------------------------
 * Initialisatie
 * ---------------------------------------------- */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[klanten] pagina geladen, init start');
  SuperhondUI.mount({ title: 'Klanten', icon: '👤', back: '../dashboard/' });

  await initFromConfig();

  $('#search')?.addEventListener('input', doFilter);
  $('#refresh')?.addEventListener('click', refresh);
  $('#form-add')?.addEventListener('submit', onSubmit);

  console.log('[klanten] Eventlisteners toegevoegd, data laden…');
  await refresh();
  console.log('[klanten] Init volledig afgerond');
});
