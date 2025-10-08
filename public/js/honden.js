/**
 * public/js/honden.js — Lijst + zoeken + toevoegen (v0.21.0)
 * Werkt met public/js/sheets.js (proxy-first, timeouts, retries)
 */

import {
  initFromConfig,
  fetchSheet,
  saveHond,
} from '../js/sheets.js';

// ───────────────────────── Utils ─────────────────────────
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function debounce(fn, ms = 250) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function toast(msg, type='info'){
  if (typeof window.SuperhondToast === 'function') window.SuperhondToast(msg, type);
  else console[(type === 'error' ? 'error' : 'log')](msg);
}

function setState(text, kind='muted'){
  const el = $('#state');
  if (!el) return;
  el.className = kind;
  el.textContent = text;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );
}

function clearErrors(form){
  $$('.input-error', form).forEach(el => el.classList.remove('input-error'));
  $$('.field-error', form).forEach(el => el.remove());
}
function setFieldError(input, msg){
  input.classList.add('input-error');
  const hint = document.createElement('div');
  hint.className = 'field-error';
  hint.textContent = msg;
  input.insertAdjacentElement('afterend', hint);
}

function fmtDateISOtoLocal(iso){
  // Verwacht 'YYYY-MM-DD' → 'DD/MM/YYYY'
  const s = String(iso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '';
  const [y,m,d] = s.split('-');
  return `${d}/${m}/${y}`;
}

// ───────────────────────── Data & render ─────────────────────────
let allRows = [];    // onbewerkte lijst van honden (volledig)
let viewRows = [];   // gefilterd op zoekterm

function normalizeRow(row){
  // Headers komen uit readSheet('Honden') in GAS. We normaliseren de kernvelden.
  const o = Object.create(null);
  for (const [k,v] of Object.entries(row || {})) {
    o[String(k||'').toLowerCase()] = v;
  }
  // aliasen/varianten
  o.id        = o.id ?? o.hondid ?? o['hond id'] ?? o['id.'] ?? o.col1 ?? '';
  o.name      = o.name ?? o.naam ?? '';
  o.breed     = o.breed ?? o.ras ?? '';
  o.birthdate = o.birthdate ?? o.geboorte ?? o['geboortedatum'] ?? '';
  o.ownerid   = o.ownerid ?? o['ownerid'] ?? o['eigenaarid'] ?? o['eigenaar (id)'] ?? o.eigenaar ?? '';
  o.chip      = o.chip ?? o['chipnummer'] ?? '';
  o.notes     = o.notes ?? o.notities ?? o.opm ?? o.opmerking ?? '';
  return o;
}

function rowMatchesQuery(row, q){
  if (!q) return true;
  const hay = [
    row.name, row.breed, row.ownerid, row.chip, row.notes
  ].map(x => String(x||'').toLowerCase()).join(' ');
  return hay.includes(q);
}

function renderTable(rows){
  const tb = $('#tbl tbody');
  if (!tb) return;
  tb.innerHTML = '';

  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="5" class="muted">Geen resultaten.</td></tr>`;
    return;
  }

  const frag = document.createDocumentFragment();
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.name || '')}</td>
      <td>${escapeHtml(r.breed || '')}</td>
      <td>${escapeHtml(fmtDateISOtoLocal(r.birthdate))}</td>
      <td class="nowrap">${escapeHtml(r.ownerid || '')}</td>
      <td class="nowrap">
        <button class="btn btn-xs" data-id="${escapeHtml(r.id||'')}" data-action="view">Bekijken</button>
      </td>
    `;
    frag.appendChild(tr);
  });
  tb.appendChild(frag);
}

const doFilter = debounce(() => {
  const q = String($('#search')?.value || '').trim().toLowerCase();
  viewRows = allRows.filter(r => rowMatchesQuery(r, q));
  renderTable(viewRows);
}, 150);

async function refresh(){
  try {
    setState('⏳ Laden…', 'muted');
    const rows = await fetchSheet('Honden');  // proxy-first; fallback via sheets.js
    allRows = (rows || []).map(normalizeRow);
    // Standaard sorteren op naam
    allRows.sort((a,b) => String(a.name||'').localeCompare(String(b.name||''), 'nl'));
    viewRows = allRows.slice();
    renderTable(viewRows);
    setState(`✅ ${viewRows.length} hond${viewRows.length===1?'':'en'} geladen`, 'muted');
  } catch (err) {
    console.error(err);
    setState(`❌ Fout bij laden: ${err?.message || err}`, 'error');
    toast('Laden van honden mislukt', 'error');
  }
}

// ───────────────────────── Form submit ─────────────────────────
async function onSubmitAdd(e){
  e.preventDefault();
  const form = e.currentTarget;
  clearErrors(form);

  const fd = new FormData(form);
  const name      = String(fd.get('name')||'').trim();
  const breed     = String(fd.get('breed')||'').trim();
  const birthdate = String(fd.get('birthdate')||'').trim(); // YYYY-MM-DD
  const ownerId   = String(fd.get('ownerId')||'').trim();
  const chip      = String(fd.get('chip')||'').trim();
  const notes     = String(fd.get('notes')||'').trim();

  let hasErr = false;
  if (!name)    { setFieldError(form.querySelector('[name="name"]'), 'Naam is verplicht'); hasErr = true; }
  if (!ownerId) { setFieldError(form.querySelector('[name="ownerId"]'), 'Eigenaar ID is verplicht'); hasErr = true; }
  // Optional: birthdate validatie
  if (birthdate && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
    setFieldError(form.querySelector('[name="birthdate"]'), 'Ongeldige datum (YYYY-MM-DD)'); hasErr = true;
  }
  if (hasErr) return;

  const payload = { name, breed, birthdate, ownerId, chip, notes };

  const msg = $('#form-msg');
  if (msg) { msg.className = 'muted'; msg.textContent = '⏳ Opslaan…'; }

  try {
    const res = await saveHond(payload);  // { id }
    const id  = res?.id || '';
    toast('✅ Hond opgeslagen', 'ok');

    // voeg toe aan lokale lijst
    const nieuw = normalizeRow({ id, name, breed, birthdate, ownerId, chip, notes });
    allRows.push(nieuw);
    allRows.sort((a,b) => String(a.name||'').localeCompare(String(b.name||''), 'nl'));

    // respecteer actieve filter
    const q = String($('#search')?.value || '').trim().toLowerCase();
    viewRows = allRows.filter(r => rowMatchesQuery(r, q));
    renderTable(viewRows);

    if (msg) { msg.textContent = `✅ Bewaard (id: ${id})`; }
    form.reset();
  } catch (err) {
    console.error(err);
    if (msg) { msg.className = 'error'; msg.textContent = `❌ Opslaan mislukt: ${err?.message || err}`; }
    toast('Opslaan mislukt', 'error');
  }
}

// ───────────────────────── Mount ─────────────────────────
async function main(){
  // Topbar mount (uniform; subpage = blauwe balk + back-knop)
  if (window.SuperhondUI?.mount) {
    document.body.classList.add('subpage');
    window.SuperhondUI.mount({ title:'Honden', icon:'🐶', back:'../dashboard/' });
  }

  // init config (zet evt. GAS base) en init UI
  await initFromConfig();

  // events
  $('#refresh')?.addEventListener('click', refresh);
  $('#search')?.addEventListener('input', doFilter);
  $('#form-add')?.addEventListener('submit', onSubmitAdd);

  // Enter → submit
  $$('#form-add input').forEach(inp => {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        $('#form-add')?.requestSubmit();
      }
    });
  });

  // initial load
  await refresh();
}

// Start
document.addEventListener('DOMContentLoaded', main, { once:true });
