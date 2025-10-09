/**
 * public/js/klanten.js — Lijst + zoeken + toevoegen (v0.25.0)
 * - Actiekolom met 👁️ ✏️ 🗑️
 * - Edit & Delete via postAction (main.gs v2.1)
 * - Titel fixes + status-select voorgedrukt
 * - Opslaan-knop (nieuw klant) activeert op geldige invoer
 */

import {
  initFromConfig,
  fetchSheet,
  saveKlant,
  postAction
} from './sheets.js';

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
  const digits = v.replace(/[^\d+]/g,'');
  const href = /^\+/.test(digits) ? digits : digits.replace(/^0/, '+32');
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

// ───────────────────────── Data & helpers ─────────────────────────
const TIMEOUT_MS = 20000;
const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

let allRows = [];
let viewRows = [];
let lastAbort = null;

/** Vangt verschillende responsevormen op en geeft altijd een array terug. */
function toArrayRows(x) {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x && Array.isArray(x.rows)) return x.rows;
  if (x && Array.isArray(x.result)) return x.result;
  if (x && x.ok === true && Array.isArray(x.data)) return x.data; // legacy
  throw new Error('Server gaf onverwachte respons (geen lijst).');
}

/** Probeer eerst tab 'Klanten', val anders terug op 'Leden'. */
async function fetchKlantenArray(opts) {
  try {
    const raw = await fetchSheet('Klanten', opts);
    return toArrayRows(raw);
  } catch (e1) {
    try {
      const raw2 = await fetchSheet('Leden', opts);
      return toArrayRows(raw2);
    } catch (e2) {
      throw e1;
    }
  }
}

function normalizeRow(row){
  const o = Object.create(null);
  for (const [k,v] of Object.entries(row || {})) {
    o[String(k||'').toLowerCase()] = v;
  }
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
  const hay = [ row.naam, row.email, row.telefoon, row.status ]
    .map(x => String(x||'').toLowerCase()).join(' ');
  return hay.includes(q);
}

// ───────────────────────── Tabel ─────────────────────────
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
        <div class="btn-group">
          <button class="btn btn-xs btn-icon" title="Bekijken"  data-action="view"   data-id="${escapeHtml(r.id||'')}" aria-label="Bekijken: ${escapeHtml(r.naam||'klant')}">👁️</button>
          <button class="btn btn-xs btn-icon" title="Wijzigen"  data-action="edit"   data-id="${escapeHtml(r.id||'')}" aria-label="Wijzigen: ${escapeHtml(r.naam||'klant')}">✏️</button>
          <button class="btn btn-xs btn-icon danger" title="Verwijderen" data-action="delete" data-id="${escapeHtml(r.id||'')}" aria-label="Verwijderen: ${escapeHtml(r.naam||'klant')}">🗑️</button>
        </div>
      </td>
    `;
    frag.appendChild(tr);
  }
  tb.appendChild(frag);
}

// live filter
const doFilter = debounce(() => {
  const q = String($('#search')?.value || '').trim().toLowerCase();
  viewRows = allRows.filter(r => rowMatchesQuery(r, q));
  renderTable(viewRows);
}, 150);

// ───────────────────────── Modal helpers ─────────────────────────
function ensureModalRoot(){
  let root = document.getElementById('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    document.body.appendChild(root);
  }
  return root;
}
function closeModal(){
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}
function modal(contentHTML, {title='Details'} = {}){
  ensureModalRoot();
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <style>
      #modal-root .sh-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:1000}
      #modal-root .sh-modal{background:#fff;border-radius:12px;min-width:300px;max-width:640px;width:clamp(300px,90vw,640px);box-shadow:0 10px 30px rgba(0,0,0,.2)}
      #modal-root .sh-head{display:flex;align-items:center;justify-content:space-between;padding:.8rem 1rem;border-bottom:1px solid #e5e7eb;font-weight:700}
      #modal-root .sh-body{padding:1rem}
      #modal-root .sh-foot{display:flex;gap:.5rem;justify-content:flex-end;padding:0 1rem 1rem}
      #modal-root .sh-close{appearance:none;border:1px solid #d1d5db;border-radius:8px;background:#fff;padding:.3rem .6rem;cursor:pointer}
      #modal-root .row{display:grid;grid-template-columns:160px 1fr;gap:.35rem .75rem;margin:.15rem 0}
      #modal-root .key{color:#6b7280}
      #modal-root .btn{border:1px solid #cbd5e1;border-radius:8px;padding:.4rem .7rem;cursor:pointer}
      #modal-root .btn.primary{background:#2563eb;color:#fff;border-color:#2563eb}
      #modal-root .btn.danger{background:#ef4444;color:#fff;border-color:#ef4444}
      @media (max-width:560px){ #modal-root .row{grid-template-columns:1fr} }
    </style>
    <div class="sh-overlay" data-close="1" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="sh-modal" role="document">
        <div class="sh-head">
          <span>${escapeHtml(title)}</span>
          <button class="sh-close" type="button" data-close="1" aria-label="Sluiten">✕</button>
        </div>
        <div class="sh-body">${contentHTML}</div>
      </div>
    </div>`;
  const onClose = (e)=>{ if (e.target?.dataset?.close === '1') closeModal(); };
  root.querySelector('.sh-overlay').addEventListener('click', onClose);
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModal(); }, { once:true });
}

// ───────── Detail bekijken ─────────
function openKlantView(id){
  const r = allRows.find(x => String(x.id) === String(id));
  if (!r) { toast('Klant niet gevonden', 'error'); return; }
  const html = `
    <div class="row"><div class="key">Naam</div><div>${escapeHtml(r.naam||'')}</div></div>
    <div class="row"><div class="key">E-mail</div><div>${r.email ? `<a href="mailto:${escapeHtml(r.email)}">${escapeHtml(r.email)}</a>` : '—'}</div></div>
    <div class="row"><div class="key">Telefoon</div><div>${escapeHtml(r.telefoon||'—')}</div></div>
    <div class="row"><div class="key">Status</div><div>${escapeHtml(r.status||'—')}</div></div>
    <div class="row"><div class="key">ID</div><div><code>${escapeHtml(r.id||'')}</code></div></div>
  `;
  modal(html, { title: `Klant bekijken` });
}

// ───────── Wijzigen (e-mail/telefoon/status) ─────────
function openKlantEdit(id){
  const r = allRows.find(x => String(x.id) === String(id));
  if (!r) { toast('Klant niet gevonden', 'error'); return; }
  const html = `
    <form id="edit-form">
      <div class="row"><div class="key">Naam</div><div><strong>${escapeHtml(r.naam||'')}</strong></div></div>
      <div class="row"><div class="key">E-mail</div><div><input class="input" name="email" type="email" value="${escapeHtml(r.email||'')}" placeholder="naam@voorbeeld.be"></div></div>
      <div class="row"><div class="key">Telefoon</div><div><input class="input" name="telefoon" type="text" value="${escapeHtml(r.telefoon||'')}"></div></div>
      <div class="row"><div class="key">Status</div><div>
        <select class="input" name="status">
          <option value="actief" ${r.status==='actief'?'selected':''}>actief</option>
          <option value="inactief" ${r.status==='inactief'?'selected':''}>inactief</option>
        </select>
      </div></div>
      <div class="sh-foot">
        <button type="button" class="btn" data-close="1">Annuleren</button>
        <button type="submit" class="btn primary">Opslaan</button>
      </div>
    </form>`;
  modal(html, { title: 'Klant wijzigen' });

  $('#edit-form')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email')||'').trim();
    const telefoon = String(fd.get('telefoon')||'').trim();
    const status = String(fd.get('status')||'').trim() || 'actief';
    // eenvoudige validatie
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast('Ongeldig e-mailadres', 'error'); return;
    }
    try{
      await postAction('klant','update', { id: r.id, email, telefoon, status });
      // lokaal updaten
      r.email = email; r.telefoon = telefoon; r.status = status;
      renderTable(applyActiveFilter());
      closeModal();
      toast('Wijzigingen opgeslagen', 'ok');
    }catch(err){
      console.error(err);
      toast('Opslaan mislukt: '+ (err?.message||err), 'error');
    }
  });
}

function applyActiveFilter(){
  const q = String($('#search')?.value || '').trim().toLowerCase();
  viewRows = allRows.filter(r => rowMatchesQuery(r, q));
  return viewRows;
}

// ───────── Verwijderen ─────────
async function deleteKlant(id){
  const r = allRows.find(x => String(x.id) === String(id));
  if (!r) { toast('Klant niet gevonden', 'error'); return; }
  if (!confirm(`Weet je zeker dat je "${r.naam || 'deze klant'}" wil verwijderen?`)) return;
  try{
    await postAction('klant','delete', { id });
    // lokaal verwijderen
    allRows = allRows.filter(x => String(x.id)!==String(id));
    renderTable(applyActiveFilter());
    toast('Klant verwijderd', 'ok');
  }catch(err){
    console.error(err);
    toast('Verwijderen mislukt: '+(err?.message||err), 'error');
  }
}

// ───────────────────────── Data laden ─────────────────────────
async function refresh(){
  if (lastAbort) lastAbort.abort();
  const ac = new AbortController();
  lastAbort = ac;

  try {
    setState('⏳ Laden…', 'muted');

    const rows = await fetchKlantenArray({ timeout: TIMEOUT_MS, signal: ac.signal });
    allRows = rows.map(normalizeRow);

    allRows.sort((a,b) => collator.compare(a.naam||'', b.naam||''));

    // Unieke ID’s
    const seen = new Set();
    allRows = allRows.filter(r => {
      if (!r.id) return true;
      if (seen.has(r.id)) return false;
      seen.add(r.id); return true;
    });

    renderTable(applyActiveFilter());
    setState(`✅ ${viewRows.length} klant${viewRows.length===1?'':'en'} geladen`, 'muted');
    window.SuperhondUI?.setOnline?.(true);
  } catch (err) {
    if (err?.name === 'AbortError') return;
    console.error(err);
    setState(`❌ Fout bij laden: ${err?.message || err}`, 'error');
    toast(`Laden van klanten mislukt: ${err?.message || err}`, 'error');
    window.SuperhondUI?.setOnline?.(false);
  }
}

// ───────────────────────── Nieuw klant toevoegen ─────────────────────────
function ensureStatusSelectDefault(){
  // Zorg dat status altijd een voorgedrukte keuze is: actief/inactief (default = actief)
  const sel = document.querySelector('#form-add [name="status"]');
  if (!sel) return;
  if (sel.tagName !== 'SELECT') return;
  if (!sel.options || sel.options.length === 0) {
    for (const {v,t} of [{v:'actief',t:'actief'},{v:'inactief',t:'inactief'}]) {
      const o = document.createElement('option'); o.value=v; o.textContent=t; sel.appendChild(o);
    }
  }
  sel.value = sel.value || 'actief';
}

function wireAddFormValidation(){
  const form = $('#form-add'); if (!form) return;
  const btn  = form.querySelector('[type="submit"]') || form.querySelector('button') || null;
  if (btn) btn.type = 'submit'; // fallback: forceer submit-type
  const fn = form.querySelector('[name="voornaam"]');
  const ln = form.querySelector('[name="achternaam"]');
  const em = form.querySelector('[name="email"]');

  function validate(){
    const hasFn = !!String(fn?.value||'').trim();
    const hasLn = !!String(ln?.value||'').trim();
    const okMail = !em?.value || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(em.value).trim());
    const ok = hasFn && hasLn && okMail;
    if (btn) btn.disabled = !ok;
    return ok;
  }
  ['input','change','blur'].forEach(ev=>{
    fn?.addEventListener(ev, validate);
    ln?.addEventListener(ev, validate);
    em?.addEventListener(ev, validate);
  });
  validate();
}

async function onSubmitAdd(e){
  e.preventDefault();
  const form = e.currentTarget;
  clearErrors(form);

  const fd = new FormData(form);
  const voornaam   = String(fd.get('voornaam')||'').trim();
  const achternaam = String(fd.get('achternaam')||'').trim();
  const email      = String(fd.get('email')||'').trim();
  const telefoon   = String(fd.get('telefoon')||'').trim();
  const selStatus  = form.querySelector('[name="status"]');
  const status     = selStatus && selStatus.value ? selStatus.value : 'actief';

  let hasErr = false;
  if (!voornaam)   { setFieldError(form.querySelector('[name="voornaam"]'),   'Voornaam is verplicht'); hasErr = true; }
  if (!achternaam) { setFieldError(form.querySelector('[name="achternaam"]'), 'Achternaam is verplicht'); hasErr = true; }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    setFieldError(form.querySelector('[name="email"]'), 'Ongeldig e-mailadres'); hasErr = true;
  }
  if (hasErr) return;

  const msg = $('#form-msg'); if (msg) { msg.className = 'muted'; msg.textContent = '⏳ Opslaan…'; }

  try {
    const res = await saveKlant({ voornaam, achternaam, email, telefoon, status });  // verwacht { id }
    const id  = res?.id || '';

    toast('✅ Klant opgeslagen', 'ok');

    const nieuw = normalizeRow({ id, voornaam, achternaam, naam:`${voornaam} ${achternaam}`.trim(), email, telefoon, status });
    allRows.push(nieuw);
    allRows.sort((a,b) => collator.compare(a.naam||'', b.naam||''));
    renderTable(applyActiveFilter());

    if (msg) { msg.textContent = `✅ Bewaard (id: ${id})`; }
    form.reset();
    if (selStatus) selStatus.value = 'actief';
    const first = form.querySelector('input,select,textarea'); first && first.focus();
  } catch (err) {
    console.error(err);
    if (msg) { msg.className = 'error'; msg.textContent = `❌ Opslaan mislukt: ${err?.message || err}`; }
    toast('Opslaan mislukt', 'error');
  }
}

// ───────────────────────── Titels fixen ─────────────────────────
function tweakTitles(){
  // Vervang “Nieuw lid” → “Nieuw klant” (ook varianten)
  $$('h2, h3, .card h2, .card h3, label, .page-title').forEach(el=>{
    const t = el.textContent || '';
    if (/Nieuw\s+lid/i.test(t)) el.textContent = t.replace(/Nieuw\s+lid/ig, 'Nieuw klant');
    if (/Nieuw\s+lid\s+toevoegen/i.test(t)) el.textContent = t.replace(/Nieuw\s+lid\s+toevoegen/ig, 'Nieuw klant toevoegen');
  });
}

// ───────────────────────── Mount ─────────────────────────
async function main(){
  // Topbar mount
  if (window.SuperhondUI?.mount) {
    document.body.classList.add('subpage');
    window.SuperhondUI.mount({ title:'Klanten', icon:'👤', back:'../dashboard/', home:false });
  }

  // init config
  await initFromConfig();

  // titels + status + form-validatie
  tweakTitles();
  ensureStatusSelectDefault();
  wireAddFormValidation();

  // events
  $('#refresh')?.addEventListener('click', refresh);
  $('#search')?.addEventListener('input', doFilter);
  $('#form-add')?.addEventListener('submit', onSubmitAdd);

  // Actieknoppen (👁️ ✏️ 🗑️)
  $('#tbl')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'view')   return openKlantView(id);
    if (action === 'edit')   return openKlantEdit(id);
    if (action === 'delete') return deleteKlant(id);
  });

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

document.addEventListener('DOMContentLoaded', main, { once:true });
