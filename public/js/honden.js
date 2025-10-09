/**
 * public/js/honden.js — Lijst + zoeken + toevoegen (v0.26.0)
 * - Actiekolom (👁️ ✏️ 🗑️) via actions.js
 * - Owner-koppeling verplicht (ownerId moet bestaan)
 * - Typeahead op bestaande klanten (voor ownerId) bij toevoegen & wijzigen
 * - Update/Delete via postAction('hond', ...)
 */

import {
  initFromConfig,
  fetchSheet,
  saveHond,
  postAction
} from './sheets.js';

import {
  actionBtns,
  wireActionHandlers
} from './actions.js';

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

function fmtDateISOtoLocal(iso){
  // 'YYYY-MM-DD' → 'DD/MM/YYYY'
  const s = String(iso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '';
  const [y,m,d] = s.split('-');
  return `${d}/${m}/${y}`;
}

// ───────────────────────── Data & helpers ─────────────────────────
const TIMEOUT_MS = 20000;
const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

let allRows = [];        // honden
let viewRows = [];
let lastAbort = null;

let owners = [];         // klanten/leden als eigenaarsbron
let ownersById = new Map();

/** Vangt verschillende responsevormen op en geeft altijd een array terug. */
function toArrayRows(x) {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x && Array.isArray(x.rows)) return x.rows;
  if (x && Array.isArray(x.result)) return x.result;
  if (x && x.ok === true && Array.isArray(x.data)) return x.data; // legacy
  throw new Error('Server gaf onverwachte respons (geen lijst).');
}

// ---- Klanten laden als eigenaars ----
async function fetchOwnersArray(opts) {
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

function normOwnerRow(row){
  const o = {};
  for (const [k,v] of Object.entries(row || {})) {
    o[String(k||'').toLowerCase()] = v;
  }
  const id = (o.id ?? o.klantid ?? o['klant id'] ?? o['id.'] ?? o['klant_id'] ?? o.col1 ?? '').toString();
  const vn = (o.voornaam || '').toString().trim();
  const an = (o.achternaam || '').toString().trim();
  const naam = (o.naam || `${vn} ${an}`.trim() || '').toString();
  const email = (o.email || '').toString();
  const telefoon = (o.telefoon || o.gsm || '').toString();
  return { id, naam, email, telefoon };
}

function buildOwnersIndex(list){
  ownersById = new Map();
  for (const r of list) {
    if (!r.id) continue;
    ownersById.set(String(r.id), r);
  }
}

// ---- Honden normalisatie ----
function normalizeRow(row){
  const o = Object.create(null);
  for (const [k,v] of Object.entries(row || {})) {
    o[String(k||'').toLowerCase()] = v;
  }
  o.id        = (o.id ?? o.hondid ?? o['hond id'] ?? o['id.'] ?? o.col1 ?? '').toString();
  o.name      = (o.name ?? o.naam ?? '').toString();
  o.breed     = (o.breed ?? o.ras ?? '').toString();
  o.birthdate = (o.birthdate ?? o.geboorte ?? o['geboortedatum'] ?? '').toString();
  o.ownerid   = (o.ownerid ?? o['ownerid'] ?? o['eigenaarid'] ?? o['eigenaar (id)'] ?? o.eigenaar ?? '').toString();
  o.chip      = (o.chip ?? o['chipnummer'] ?? '').toString();
  o.notes     = (o.notes ?? o.notities ?? o.opm ?? o.opmerking ?? '').toString();
  o.status    = (o.status ?? '').toString();
  return o;
}

function rowMatchesQuery(row, q){
  if (!q) return true;
  const hay = [
    row.name, row.breed, row.ownerid, row.chip, row.notes, row.status
  ].map(x => String(x||'').toLowerCase()).join(' ');
  return hay.includes(q);
}

// ───────────────────────── Typeahead voor eigenaar ─────────────────────────
function attachOwnerTypeahead(input, { prefillId = '' } = {}){
  if (!input) return;

  // datalist voor native suggesties (fallback)
  let list = document.getElementById('owners-list');
  if (!list) {
    list = document.createElement('datalist');
    list.id = 'owners-list';
    document.body.appendChild(list);
  }
  input.setAttribute('list', 'owners-list');

  function optionLabel(o){
    const parts = [o.naam || '—'];
    if (o.email) parts.push(`‹${o.email}›`);
    parts.push(`[${o.id}]`);
    return parts.join(' ');
  }
  function refreshOptions(filter=''){
    const needle = filter.trim().toLowerCase();
    list.innerHTML = '';
    let cnt = 0;
    for (const o of owners) {
      const label = optionLabel(o);
      if (!needle || label.toLowerCase().includes(needle)) {
        const opt = document.createElement('option');
        opt.value = o.id;           // waarde = id (belangrijk)
        opt.label = label;          // label = “Naam ‹mail› [id]”
        list.appendChild(opt);
        if (++cnt >= 50) break;     // niet overdrijven
      }
    }
  }

  input.addEventListener('input', ()=> refreshOptions(input.value));
  input.addEventListener('focus', ()=> refreshOptions(input.value));

  // Pre-fill op basis van meegegeven id
  if (prefillId && ownersById.has(prefillId)) {
    input.value = prefillId;
  } else if (prefillId) {
    input.value = ''; // invalide id niet tonen
  }
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
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.name || '')}</td>
      <td>${escapeHtml(r.breed || '')}</td>
      <td>${escapeHtml(fmtDateISOtoLocal(r.birthdate))}</td>
      <td class="nowrap">${escapeHtml(r.ownerid || '')}</td>
      <td class="nowrap">
        ${actionBtns({ id: r.id, entity: 'hond' })}
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
      #modal-root .sh-modal{background:#fff;border-radius:12px;min-width:300px;max-width:720px;width:clamp(300px,92vw,720px);box-shadow:0 10px 30px rgba(0,0,0,.2)}
      #modal-root .sh-head{display:flex;align-items:center;justify-content:space-between;padding:.8rem 1rem;border-bottom:1px solid #e5e7eb;font-weight:700}
      #modal-root .sh-body{padding:1rem}
      #modal-root .sh-foot{display:flex;gap:.5rem;justify-content:flex-end;padding:0 1rem 1rem}
      #modal-root .sh-close{appearance:none;border:1px solid #d1d5db;border-radius:8px;background:#fff;padding:.3rem .6rem;cursor:pointer}
      #modal-root .row{display:grid;grid-template-columns:180px 1fr;gap:.35rem .75rem;margin:.15rem 0}
      #modal-root .key{color:#6b7280}
      #modal-root .input, #modal-root select { width:100%; padding:.45rem .55rem; border:1px solid #cbd5e1; border-radius:8px }
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

// ───────── Bekijken ─────────
function openHondView(id){
  const r = allRows.find(x => String(x.id) === String(id));
  if (!r) { toast('Hond niet gevonden', 'error'); return; }
  const owner = ownersById.get(r.ownerid);
  const ownerLabel = owner ? `${owner.naam} [${owner.id}]` : (r.ownerid || '—');

  const html = `
    <div class="row"><div class="key">Naam</div><div>${escapeHtml(r.name||'')}</div></div>
    <div class="row"><div class="key">Ras</div><div>${escapeHtml(r.breed||'—')}</div></div>
    <div class="row"><div class="key">Geboortedatum</div><div>${escapeHtml(fmtDateISOtoLocal(r.birthdate)||'—')}</div></div>
    <div class="row"><div class="key">Eigenaar</div><div>${escapeHtml(ownerLabel)}</div></div>
    <div class="row"><div class="key">Chip</div><div>${escapeHtml(r.chip||'—')}</div></div>
    <div class="row"><div class="key">Notities</div><div>${escapeHtml(r.notes||'—')}</div></div>
    <div class="row"><div class="key">Status</div><div>${escapeHtml(r.status||'—')}</div></div>
    <div class="row"><div class="key">ID</div><div><code>${escapeHtml(r.id||'')}</code></div></div>
  `;
  modal(html, { title: 'Hond bekijken' });
}

// ───────── Wijzigen ─────────
function openHondEdit(id){
  const r = allRows.find(x => String(x.id) === String(id));
  if (!r) { toast('Hond niet gevonden', 'error'); return; }

  const html = `
    <form id="edit-form">
      <div class="row"><div class="key">Naam</div><div><input class="input" name="name" value="${escapeHtml(r.name||'')}" required></div></div>
      <div class="row"><div class="key">Ras</div><div><input class="input" name="breed" value="${escapeHtml(r.breed||'')}"></div></div>
      <div class="row"><div class="key">Geboortedatum</div><div><input class="input" name="birthdate" type="date" value="${escapeHtml(r.birthdate||'')}"></div></div>
      <div class="row"><div class="key">Eigenaar (ID)</div><div>
        <input class="input" id="edit-owner" name="ownerId" placeholder="Zoek en kies eigenaar (id)" value="${escapeHtml(r.ownerid||'')}" autocomplete="off">
        <small class="muted">Typ de eerste letters van de eigenaar; kies een suggestie. Waarde = ID.</small>
      </div></div>
      <div class="row"><div class="key">Chip</div><div><input class="input" name="chip" value="${escapeHtml(r.chip||'')}"></div></div>
      <div class="row"><div class="key">Notities</div><div><textarea class="input" name="notes" rows="3">${escapeHtml(r.notes||'')}</textarea></div></div>
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
  modal(html, { title: 'Hond wijzigen' });

  // typeahead op owner in edit
  attachOwnerTypeahead($('#edit-owner'), { prefillId: r.ownerid });

  $('#edit-form')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      id: r.id,
      name:      String(fd.get('name')||'').trim(),
      breed:     String(fd.get('breed')||'').trim(),
      birthdate: String(fd.get('birthdate')||'').trim(),
      ownerId:   String(fd.get('ownerId')||'').trim(),
      chip:      String(fd.get('chip')||'').trim(),
      notes:     String(fd.get('notes')||'').trim(),
      status:    String(fd.get('status')||'').trim() || 'actief'
    };

    // validatie
    if (!payload.name) { toast('Naam is verplicht', 'error'); return; }
    if (payload.birthdate && !/^\d{4}-\d{2}-\d{2}$/.test(payload.birthdate)) {
      toast('Ongeldige geboortedatum (YYYY-MM-DD)', 'error'); return;
    }
    if (!ownersById.has(payload.ownerId)) {
      toast('Eigenaar niet gevonden — kies een bestaande klant', 'error'); return;
    }

    try{
      await postAction('hond','update', payload);
      Object.assign(r, normalizeRow(payload));
      renderTable(applyActiveFilter());
      closeModal();
      toast('Wijzigingen opgeslagen','ok');
    }catch(err){
      console.error(err);
      toast('Opslaan mislukt: '+(err?.message||err), 'error');
    }
  });
}

// ───────── Verwijderen ─────────
async function deleteHond(id){
  const r = allRows.find(x => String(x.id) === String(id));
  if (!r) { toast('Hond niet gevonden', 'error'); return; }
  if (!confirm(`Weet je zeker dat je "${r.name || 'deze hond'}" wil verwijderen?`)) return;
  try{
    await postAction('hond','delete', { id });
    allRows = allRows.filter(x => String(x.id)!==String(id));
    renderTable(applyActiveFilter());
    toast('Hond verwijderd', 'ok');
  }catch(err){
    console.error(err);
    toast('Verwijderen mislukt: '+(err?.message||err), 'error');
  }
}

function applyActiveFilter(){
  const q = String($('#search')?.value || '').trim().toLowerCase();
  viewRows = allRows.filter(r => rowMatchesQuery(r, q));
  return viewRows;
}

// ───────────────────────── Data laden ─────────────────────────
async function refresh(){
  if (lastAbort) lastAbort.abort();
  const ac = new AbortController();
  lastAbort = ac;

  try {
    setState('⏳ Laden…', 'muted');

    // eigenaars eerst (nodig voor labeling/validatie)
    const ownersRaw = await fetchOwnersArray({ timeout: TIMEOUT_MS, signal: ac.signal });
    owners = ownersRaw.map(normOwnerRow).filter(o => o.id);
    buildOwnersIndex(owners);

    // honden
    const raw = await fetchSheet('Honden', { timeout: TIMEOUT_MS, signal: ac.signal });
    const rows = toArrayRows(raw);
    allRows = rows.map(normalizeRow);
    allRows.sort((a,b) => collator.compare(a.name||'', b.name||''));

    renderTable(applyActiveFilter());
    setState(`✅ ${viewRows.length} hond${viewRows.length===1?'':'en'} geladen`, 'muted');
    window.SuperhondUI?.setOnline?.(true);
  } catch (err) {
    if (err?.name === 'AbortError') return;
    console.error(err);
    setState(`❌ Fout bij laden: ${err?.message || err}`, 'error');
    toast('Laden van honden mislukt', 'error');
    window.SuperhondUI?.setOnline?.(false);
  }
}

// ───────────────────────── Form submit (Nieuwe hond) ─────────────────────────
function wireAddFormValidation(){
  const form = $('#form-add'); if (!form) return;
  const btn  = form.querySelector('[type="submit"]') || form.querySelector('button') || null;
  if (btn) btn.type = 'submit'; // forceer submit-type
  const name = form.querySelector('[name="name"]');
  const owner = form.querySelector('[name="ownerId"]');
  const birth = form.querySelector('[name="birthdate"]');

  function validate(){
    const okName  = !!String(name?.value||'').trim();
    const oid     = String(owner?.value||'').trim();
    const okOwner = oid && ownersById.has(oid);
    const okDate  = !birth?.value || /^\d{4}-\d{2}-\d{2}$/.test(birth.value);
    const ok = okName && okOwner && okDate;
    if (btn) btn.disabled = !ok;
    return ok;
  }
  ['input','change','blur'].forEach(ev=>{
    name?.addEventListener(ev, validate);
    owner?.addEventListener(ev, validate);
    birth?.addEventListener(ev, validate);
  });
  validate();
}

function setupOwnerTypeaheadForAdd(){
  const input = document.querySelector('#form-add [name="ownerId"]');
  attachOwnerTypeahead(input);
}

async function onSubmitAdd(e){
  e.preventDefault();
  const form = e.currentTarget;
  clearErrors(form);

  const fd = new FormData(form);
  const name      = String(fd.get('name')||'').trim();
  const breed     = String(fd.get('breed')||'').trim();
  const birthdate = String(fd.get('birthdate')||'').trim();
  const ownerId   = String(fd.get('ownerId')||'').trim();
  const chip      = String(fd.get('chip')||'').trim();
  const notes     = String(fd.get('notes')||'').trim();
  const status    = String(fd.get('status')||'').trim() || 'actief';

  let hasErr = false;
  if (!name)    { setFieldError(form.querySelector('[name="name"]'), 'Naam is verplicht'); hasErr = true; }
  if (!ownerId) { setFieldError(form.querySelector('[name="ownerId"]'), 'Eigenaar is verplicht'); hasErr = true; }
  if (ownerId && !ownersById.has(ownerId)) { setFieldError(form.querySelector('[name="ownerId"]'), 'Kies een bestaande eigenaar'); hasErr = true; }
  if (birthdate && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
    setFieldError(form.querySelector('[name="birthdate"]'), 'Ongeldige datum (YYYY-MM-DD)'); hasErr = true;
  }
  if (hasErr) return;

  const payload = { name, breed, birthdate, ownerId, chip, notes, status };

  const msg = $('#form-msg');
  if (msg) { msg.className = 'muted'; msg.textContent = '⏳ Opslaan…'; }

  try {
    const res = await saveHond(payload);  // verwacht { id }
    const id  = res?.id || '';
    toast('✅ Hond opgeslagen', 'ok');

    const nieuw = normalizeRow({ id, ...payload });
    allRows.push(nieuw);
    allRows.sort((a,b) => collator.compare(a.name||'', b.name||''));

    renderTable(applyActiveFilter());

    if (msg) { msg.textContent = `✅ Bewaard (id: ${id})`; }
    form.reset();
    const first = form.querySelector('input,select,textarea');
    first && first.focus();
  } catch (err) {
    console.error(err);
    if (msg) { msg.className = 'error'; msg.textContent = `❌ Opslaan mislukt: ${err?.message || err}`; }
    toast('Opslaan mislukt', 'error');
  }
}

// ───────────────────────── Mount ─────────────────────────
async function main(){
  // Topbar
  if (window.SuperhondUI?.mount) {
    document.body.classList.add('subpage');
    window.SuperhondUI.mount({ title:'Honden', icon:'🐶', back:'../dashboard/' });
  }

  // init config
  await initFromConfig();

  // events
  $('#refresh')?.addEventListener('click', refresh);
  $('#search')?.addEventListener('input', doFilter);
  $('#form-add')?.addEventListener('submit', onSubmitAdd);

  // Actieknoppen
  wireActionHandlers('#tbl', {
    view:   (id)=> openHondView(id),
    edit:   (id)=> openHondEdit(id),
    delete: (id)=> deleteHond(id),
  });

  // initial load (laadt ook eigenaars)
  await refresh();

  // setup typeahead + validatie voor 'nieuwe hond'
  setupOwnerTypeaheadForAdd();
  wireAddFormValidation();

  // Enter → submit
  $$('#form-add input').forEach(inp => {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        $('#form-add')?.requestSubmit();
      }
    });
  });
}

// Start
document.addEventListener('DOMContentLoaded', main, { once:true });
