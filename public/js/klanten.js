/**
 * public/js/klanten.js — Lijst + zoeken + toevoegen (v0.21.0)
 * Werkt met public/js/sheets.js (proxy-first, timeouts, retries)
 */

import {
  initFromConfig,
  fetchSheet,
  saveKlant,
  normStatus
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

function linkEmail(s){
  const v = String(s||'').trim();
  if (!v) return '';
  return `<a href="mailto:${escapeHtml(v)}">${escapeHtml(v)}</a>`;
}
function linkTel(s){
  const v = String(s||'').trim();
  if (!v) return '';
  const href = v.replace(/\s+/g,'');
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
  input.classList.add('input-error');
  const hint = document.createElement('div');
  hint.className = 'field-error';
  hint.textContent = msg;
  input.insertAdjacentElement('afterend', hint);
}

// ───────────────────────── Data & render ─────────────────────────
let allRows = [];    // onbewerkte lijst van klanten (volledig)
let viewRows = [];   // gefilterd op zoekterm

function normalizeRow(row){
  // Headers komen uit readSheet('Klanten') in main.gs (flexibel).
  // We proberen de belangrijkste velden te normaliseren.
  const o = Object.create(null);
  for (const [k,v] of Object.entries(row || {})) {
    o[String(k||'').toLowerCase()] = v;
  }
  // aliasen
  o.id        = o.id ?? o.klantid ?? o['klant id'] ?? o['id.'] ?? o['klant_id'] ?? o.col1 ?? '';
  o.naam      = o.naam || [o.voornaam, o.achternaam].filter(Boolean).join(' ').trim() || '';
  o.email     = o.email || '';
  o.telefoon  = o.telefoon || o.gsm || '';
  o.status    = o.status || '';
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
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.naam || '')}</td>
      <td>${linkEmail(r.email)}</td>
      <td>${linkTel(r.telefoon)}</td>
      <td>${escapeHtml(r.status || '')}</td>
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
    const rows = await fetchSheet('Klanten');  // proxy-first; fallback via sheets.js
    allRows = (rows || []).map(normalizeRow);
    // Standaard sorteren op naam
    allRows.sort((a,b) => String(a.naam||'').localeCompare(String(b.naam||''), 'nl'));
    viewRows = allRows.slice();
    renderTable(viewRows);
    setState(`✅ ${viewRows.length} klant${viewRows.length===1?'':'en'} geladen`, 'muted');
  } catch (err) {
    console.error(err);
    setState(`❌ Fout bij laden: ${err?.message || err}`, 'error');
    toast('Laden van klanten mislukt', 'error');
  }
}

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
  const status     = String(fd.get('status')||'').trim() || 'actief';

  let hasErr = false;
  if (!voornaam) { setFieldError(form.querySelector('[name="voornaam"]'), 'Voornaam is verplicht'); hasErr = true; }
  if (!achternaam) { setFieldError(form.querySelector('[name="achternaam"]'), 'Achternaam is verplicht'); hasErr = true; }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setFieldError(form.querySelector('[name="email"]'), 'Ongeldig e-mailadres'); hasErr = true; }
  if (hasErr) return;

  const payload = { voornaam, achternaam, email, telefoon, status };

  const msg = $('#form-msg');
  if (msg) { msg.className = 'muted'; msg.textContent = '⏳ Opslaan…'; }

  try {
    const res = await saveKlant(payload);  // { id }
    const id  = res?.id || '';
    toast('✅ Klant opgeslagen', 'ok');

    // voeg toe aan lokale lijst
    const nieuw = normalizeRow({
      id, voornaam, achternaam,
      naam: `${voornaam} ${achternaam}`.trim(),
      email, telefoon, status
    });
    allRows.push(nieuw);
    allRows.sort((a,b) => String(a.naam||'').localeCompare(String(b.naam||''), 'nl'));

    // eventuele actieve filter respecteren
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
    // Voor subpagina’s zetten we body.subpage in je HTML/CSS — maar layout.js dwingt de kleur sowieso
    document.body.classList.add('subpage');
    window.SuperhondUI.mount({ title:'Klanten', icon:'👤', back:'../dashboard/' });
  }

  // init config (zet evt. GAS base) en init UI
  await initFromConfig();

  // events
  $('#refresh')?.addEventListener('click', refresh);
  $('#search')?.addEventListener('input', doFilter);
  $('#form-add')?.addEventListener('submit', onSubmitAdd);

  // Voor keyboard-flow: Enter in input fields triggert submit van het formulier
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
