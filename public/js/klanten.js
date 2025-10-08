/**
 * public/js/klanten.js — Lijst + zoeken + toevoegen (v0.24.1)
 * Werkt met public/js/sheets.js (proxy-first, timeouts, retries)
 * Verbeteringen:
 *  - Correct import pad
 *  - TIMEOUT 20s voor 'Klanten'
 *  - Abortable refresh (race-safe)
 *  - Intl.Collator ('nl') sortering
 *  - Online-indicator bij fout/succes
 */

import {
  initFromConfig,
  fetchSheet,
  saveKlant,
  // normStatus  // ← niet gebruikt; mocht je willen, kun je 'status' hiermee normaliseren
} from './sheets.js'; // FIX: stond op '../js/sheets.js' (verkeerd vanuit /public/js/)

//
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
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
}

function linkEmail(s){
  const v = String(s||'').trim();
  if (!v) return '';
  return `<a href="mailto:${escapeHtml(v)}">${escapeHtml(v)}</a>`;
}
function linkTel(s){
  const v = String(s||'').trim();
  if (!v) return '';
  const href = v.replace(/\s+/g,'').replace(/^0/,'+32'); // eenvoudige BE-normalisatie (optioneel)
  return `<a href="tel:${escapeHtml(href)}">${escapeHtml(v)}</a>`;
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
  if (!input) return;
  input.classList.add('input-error');
  const hint = document.createElement('div');
  hint.className = 'field-error';
  hint.textContent = msg;
  input.insertAdjacentElement('afterend', hint);
}

//
// ───────────────────────── Data & render ─────────────────────────
const TIMEOUT_MS = 20000; // belangrijk: zwaardere tab
const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

let allRows = [];    // volledige dataset
let viewRows = [];   // gefilterd
let lastAbort = null;

function normalizeRow(row){
  // Headers komen flexibel uit GAS. Normaliseer belangrijkste velden.
  const o = Object.create(null);
  for (const [k,v] of Object.entries(row || {})) {
    o[String(k||'').toLowerCase()] = v;
  }
  // aliasen
  o.id        = (o.id ?? o.klantid ?? o['klant id'] ?? o['id.'] ?? o['klant_id'] ?? o.col1 ?? '').toString();
  const vn    = (o.voornaam || '').toString().trim();
  const an    = (o.achternaam || '').toString().trim();
  o.naam      = (o.naam || `${vn} ${an}`.trim() || '').toString();
  o.email     = (o.email || '').toString();
  o.telefoon  = (o.telefoon || o.gsm || '').toString();
  o.status    = (o.status || '').toString();
  return o;
}

function rowMatchesQuery(row, q){
  if (!q) return true;
  const hay = [
    row.naam, row.email, row.telefoon, row.status
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
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.naam || '')}</td>
      <td>${linkEmail(r.email)}</td>
      <td>${linkTel(r.telefoon)}</td>
      <td>${escapeHtml(r.status || '')}</td>
      <td class="nowrap">
        <button class="btn btn-xs" data-id="${escapeHtml(r.id||'')}" data-action="view" aria-label="Details van ${escapeHtml(r.naam||'klant')}">Bekijken</button>
      </td>
    `;
    frag.appendChild(tr);
  }
  tb.appendChild(frag);
}

const doFilter = debounce(() => {
  const q = String($('#search')?.value || '').trim().toLowerCase();
  viewRows = allRows.filter(r => rowMatchesQuery(r, q));
  renderTable(viewRows);
}, 150);

async function refresh(){
  // Maak lopende fetch abortable om race conditions te voorkomen
  if (lastAbort) lastAbort.abort();
  const ac = new AbortController();
  lastAbort = ac;

  try {
    setState('⏳ Laden…', 'muted');

    // fetchSheet accepteert extra init; voegen we signal toe voor abort
    // (Als jouw fetchSheet dit niet support, wordt signal genegeerd door native fetch binnenin.)
    const rows = await fetchSheet('Klanten', { timeout: TIMEOUT_MS, signal: ac.signal });

    allRows = (rows || []).map(normalizeRow);

    // Sorteer stabiel op naam (nl)
    allRows.sort((a,b) => collator.compare(a.naam||'', b.naam||''));

    // Unieke ID’s (veiligheid: soms dubbele rijen in sheet)
    const seen = new Set();
    allRows = allRows.filter(r => {
      if (!r.id) return true; // laat zonder id door, beter tonen dan droppen
      if (seen.has(r.id)) return false;
      seen.add(r.id); return true;
    });

    viewRows = allRows.slice();
    renderTable(viewRows);
    setState(`✅ ${viewRows.length} klant${viewRows.length===1?'':'en'} geladen`, 'muted');
    window.SuperhondUI?.setOnline?.(true);
  } catch (err) {
    if (err?.name === 'AbortError') return; // nieuwe refresh startte, negeren
    console.error(err);
    setState(`❌ Fout bij laden: ${err?.message || err}`, 'error');
    toast('Laden van klanten mislukt', 'error');
    window.SuperhondUI?.setOnline?.(false);
  }
}

//
// ───────────────────────── Form submit ─────────────────────────
async function onSubmitAdd(e){
  e.preventDefault();
  const form = e.currentTarget;
  clearErrors(form);

  const fd = new FormData(form);
  const voornaam   = String(fd.get('voornaam')||'').trim();
  const achternaam = String(fd.get('achternaam')||'').trim();
  const email      = String(fd.get('email')||'').trim();
  const telefoon   = String(fd.get('telefoon')||'').trim();
  const status     = (String(fd.get('status')||'').trim() || 'actief');

  let hasErr = false;
  if (!voornaam)   { setFieldError(form.querySelector('[name="voornaam"]'),   'Voornaam is verplicht'); hasErr = true; }
  if (!achternaam) { setFieldError(form.querySelector('[name="achternaam"]'), 'Achternaam is verplicht'); hasErr = true; }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    setFieldError(form.querySelector('[name="email"]'), 'Ongeldig e-mailadres'); hasErr = true;
  }
  if (hasErr) return;

  const payload = { voornaam, achternaam, email, telefoon, status };

  const msg = $('#form-msg');
  if (msg) { msg.className = 'muted'; msg.textContent = '⏳ Opslaan…'; }

  try {
    const res = await saveKlant(payload);  // verwacht { id }
    const id  = res?.id || '';

    toast('✅ Klant opgeslagen', 'ok');

    // Locally toevoegen
    const nieuw = normalizeRow({
      id, voornaam, achternaam,
      naam: `${voornaam} ${achternaam}`.trim(),
      email, telefoon, status
    });
    allRows.push(nieuw);
    allRows.sort((a,b) => collator.compare(a.naam||'', b.naam||''));

    // actieve filter respecteren
    const q = String($('#search')?.value || '').trim().toLowerCase();
    viewRows = allRows.filter(r => rowMatchesQuery(r, q));
    renderTable(viewRows);

    if (msg) { msg.textContent = `✅ Bewaard (id: ${id})`; }
    form.reset();
    // eerste input terug focus voor snelle datainvoer
    const first = form.querySelector('input,select,textarea');
    first && first.focus();
  } catch (err) {
    console.error(err);
    if (msg) { msg.className = 'error'; msg.textContent = `❌ Opslaan mislukt: ${err?.message || err}`; }
    toast('Opslaan mislukt', 'error');
  }
}

//
// ───────────────────────── Mount ─────────────────────────
async function main(){
  // Topbar mount (uniform; subpage = blauwe balk + back-knop)
  if (window.SuperhondUI?.mount) {
    document.body.classList.add('subpage'); // hint voor styling; kleur wordt sowieso geforceerd
    window.SuperhondUI.mount({ title:'Klanten', icon:'👤', back:'../dashboard/', home:false });
  }

  // init config (zet evt. GAS base) en init UI
  await initFromConfig();

  // events
  $('#refresh')?.addEventListener('click', refresh);
  $('#search')?.addEventListener('input', doFilter);
  $('#form-add')?.addEventListener('submit', onSubmitAdd);

  // Enter-to-submit
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
