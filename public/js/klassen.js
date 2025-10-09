/**
 * public/js/klassen.js — Lijst + zoeken + toevoegen + actiekolom (v0.26.0)
 * - Superhond actiekolom (👁️ ✏️ 🗑️) via actions.js
 * - View/Edit/Delete modals
 * - Abortable refresh, NL-sortering
 * - Status-select voorgedrukt (actief/inactief)
 */

import {
  initFromConfig,
  fetchSheet,
  saveKlas,
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
function escapeHtml(s=''){
  return String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );
}

// ───────────────────────── Helpers ─────────────────────────
const TIMEOUT_MS = 20000;
const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

let allRows = [];
let viewRows = [];
let lastAbort = null;

/** Zorgt dat respons altijd een array wordt. */
function toArrayRows(x){
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x && Array.isArray(x.rows)) return x.rows;
  if (x && Array.isArray(x.result)) return x.result;
  if (x && x.ok === true && Array.isArray(x.data)) return x.data;
  throw new Error('Server gaf onverwachte respons (geen lijst).');
}

function normalizeRow(row){
  const o = Object.create(null);
  for (const [k,v] of Object.entries(row || {})) {
    o[String(k||'').toLowerCase()] = v;
  }
  // Aliassen volgens saveKlas_
  return {
    id:       (o.id ?? o['id.'] ?? o.col1 ?? '').toString(),
    naam:     (o.naam ?? '').toString(),
    niveau:   (o.niveau ?? '').toString(),
    trainer:  (o.trainer ?? '').toString(),
    status:   (o.status ?? '').toString(),
    weeks:    (o.geldigheid_weken ?? o.weken ?? '').toString(),
    max:      (o.max_deelnemers ?? o.capaciteit ?? '').toString()
  };
}

function rowMatchesQuery(row, q){
  if (!q) return true;
  const hay = [
    row.naam, row.niveau, row.trainer, row.status
  ].map(x => String(x||'').toLowerCase()).join(' ');
  return hay.includes(q);
}

function applyActiveFilter(){
  const q = String($('#search')?.value || '').trim().toLowerCase();
  viewRows = allRows.filter(r => rowMatchesQuery(r, q));
  return viewRows;
}

// ───────────────────────── Tabel ─────────────────────────
function renderTable(rows){
  const tb = $('#tbl tbody');
  if (!tb) return;
  tb.innerHTML = '';

  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="6" class="muted">Geen resultaten.</td></tr>`;
    return;
  }

  const frag = document.createDocumentFragment();
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.naam || '')}</td>
      <td>${escapeHtml(r.niveau || '')}</td>
      <td>${escapeHtml(r.trainer || '')}</td>
      <td>${escapeHtml(r.status || '')}</td>
      <td class="nowrap">${escapeHtml(r.max || '')}</td>
      <td class="nowrap">${actionBtns({ id: r.id, entity: 'klas' })}</td>
    `;
    frag.appendChild(tr);
  }
  tb.appendChild(frag);
}

const doFilter = debounce(() => {
  renderTable(applyActiveFilter());
}, 150);

// ───────────────────────── Modals ─────────────────────────
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
      #modal-root .input, #modal-root select, #modal-root textarea { width:100%; padding:.45rem .55rem; border:1px solid #cbd5e1; border-radius:8px }
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

// — View
function openKlasView(id){
  const r = allRows.find(x => String(x.id) === String(id));
  if (!r) { toast('Klas niet gevonden', 'error'); return; }
  const html = `
    <div class="row"><div class="key">Naam</div><div>${escapeHtml(r.naam||'—')}</div></div>
    <div class="row"><div class="key">Niveau</div><div>${escapeHtml(r.niveau||'—')}</div></div>
    <div class="row"><div class="key">Trainer</div><div>${escapeHtml(r.trainer||'—')}</div></div>
    <div class="row"><div class="key">Status</div><div>${escapeHtml(r.status||'—')}</div></div>
    <div class="row"><div class="key">Max. deelnemers</div><div>${escapeHtml(r.max||'—')}</div></div>
    <div class="row"><div class="key">Weken</div><div>${escapeHtml(r.weeks||'—')}</div></div>
    <div class="row"><div class="key">ID</div><div><code>${escapeHtml(r.id||'')}</code></div></div>
  `;
  modal(html, { title: 'Klas bekijken' });
}

// — Edit
function openKlasEdit(id){
  const r = allRows.find(x => String(x.id) === String(id));
  if (!r) { toast('Klas niet gevonden', 'error'); return; }

  const html = `
    <form id="edit-form">
      <div class="row"><div class="key">Naam</div><div><input class="input" name="naam" value="${escapeHtml(r.naam||'')}" required></div></div>
      <div class="row"><div class="key">Niveau</div><div><input class="input" name="niveau" value="${escapeHtml(r.niveau||'')}"></div></div>
      <div class="row"><div class="key">Trainer</div><div><input class="input" name="trainer" value="${escapeHtml(r.trainer||'')}"></div></div>
      <div class="row"><div class="key">Max. deelnemers</div><div><input class="input" type="number" min="0" step="1" name="max_deelnemers" value="${escapeHtml(r.max||'')}"></div></div>
      <div class="row"><div class="key">Weken</div><div><input class="input" type="number" min="0" step="1" name="geldigheid_weken" value="${escapeHtml(r.weeks||'')}"></div></div>
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
  modal(html, { title: 'Klas wijzigen' });

  $('#edit-form')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      id: r.id,
      naam:     String(fd.get('naam')||'').trim(),
      niveau:   String(fd.get('niveau')||'').trim(),
      trainer:  String(fd.get('trainer')||'').trim(),
      status:   String(fd.get('status')||'').trim() || 'actief',
      // align met saveKlas_ kolommen:
      max_deelnemers: String(fd.get('max_deelnemers')||'').trim(),
      geldigheid_weken: String(fd.get('geldigheid_weken')||'').trim()
    };

    // validatie
    if (!payload.naam) { toast('Naam is verplicht', 'error'); return; }
    if (payload.max_deelnemers && !/^\d+$/.test(payload.max_deelnemers)) { toast('Max. deelnemers moet een geheel getal zijn', 'error'); return; }
    if (payload.geldigheid_weken && !/^\d+$/.test(payload.geldigheid_weken)) { toast('Weken moet een geheel getal zijn', 'error'); return; }

    try{
      await postAction('klas','update', payload);
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

// — Delete (archive/soft delete indien kolom aanwezig)
async function deleteKlas(id){
  const r = allRows.find(x => String(x.id) === String(id));
  if (!r) { toast('Klas niet gevonden', 'error'); return; }
  if (!confirm(`Weet je zeker dat je "${r.naam || 'deze klas'}" wil verwijderen/archiveren?`)) return;
  try{
    await postAction('klas','delete', { id });
    allRows = allRows.filter(x => String(x.id)!==String(id));
    renderTable(applyActiveFilter());
    toast('Klas verwijderd', 'ok');
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

  try{
    setState('⏳ Laden…','muted');

    const raw = await fetchSheet('Klassen', { timeout: TIMEOUT_MS, signal: ac.signal });
    const rows = toArrayRows(raw);
    allRows = rows.map(normalizeRow);

    // sorteer op naam, dan niveau
    allRows.sort((a,b)=>{
      const c = collator.compare(a.naam||'', b.naam||'');
      return c || collator.compare(a.niveau||'', b.niveau||'');
    });

    renderTable(applyActiveFilter());
    setState(`✅ ${viewRows.length} klas${viewRows.length===1?'':'sen'} geladen`, 'muted');
    window.SuperhondUI?.setOnline?.(true);
  }catch(err){
    if (err?.name === 'AbortError') return;
    console.error(err);
    setState(`❌ Fout bij laden: ${err?.message || err}`,'error');
    toast('Laden van klassen mislukt','error');
    window.SuperhondUI?.setOnline?.(false);
  }
}

// ───────────────────────── Form: Nieuwe klas ─────────────────────────
function ensureStatusSelectDefault(){
  const sel = document.querySelector('#form-add [name="status"]');
  if (!sel || sel.tagName !== 'SELECT') return;
  if (!sel.options || sel.options.length === 0) {
    for (const {v,t} of [{v:'actief',t:'actief'},{v:'inactief',t:'inactief'}]) {
      const o = document.createElement('option'); o.value=v; o.textContent=t; sel.appendChild(o);
    }
  }
  if (!sel.value) sel.value = 'actief';
}

function wireAddFormValidation(){
  const form = $('#form-add'); if (!form) return;
  const btn  = form.querySelector('[type="submit"]') || form.querySelector('button') || null;
  if (btn) btn.type = 'submit';
  const naam   = form.querySelector('[name="naam"]');
  const max    = form.querySelector('[name="max_deelnemers"]');
  const weken  = form.querySelector('[name="geldigheid_weken"]');

  function validate(){
    const hasNaam = !!String(naam?.value||'').trim();
    const okMax   = !max?.value || /^\d+$/.test(max.value);
    const okWeken = !weken?.value || /^\d+$/.test(weken.value);
    const ok = hasNaam && okMax && okWeken;
    if (btn) btn.disabled = !ok;
    return ok;
  }
  ['input','change','blur'].forEach(ev=>{
    naam?.addEventListener(ev, validate);
    max?.addEventListener(ev, validate);
    weken?.addEventListener(ev, validate);
  });
  validate();
}

async function onSubmitAdd(e){
  e.preventDefault();
  const form = e.currentTarget;

  const fd = new FormData(form);
  const naam   = String(fd.get('naam')||'').trim();
  const niveau = String(fd.get('niveau')||'').trim();
  const trainer= String(fd.get('trainer')||'').trim();
  const status = String(fd.get('status')||'').trim() || 'actief';
  const max_deelnemers   = String(fd.get('max_deelnemers')||'').trim();
  const geldigheid_weken = String(fd.get('geldigheid_weken')||'').trim();

  let hasErr = false;
  if (!naam){ hasErr = true; }
  if (max_deelnemers && !/^\d+$/.test(max_deelnemers)) { hasErr = true; }
  if (geldigheid_weken && !/^\d+$/.test(geldigheid_weken)) { hasErr = true; }
  if (hasErr){ toast('Controleer de velden (naam verplicht, getallen zijn geheel)','error'); return; }

  const msg = $('#form-msg');
  if (msg) { msg.className='muted'; msg.textContent='⏳ Opslaan…'; }

  try{
    const res = await saveKlas({ naam, niveau, trainer, status, max_deelnemers, geldigheid_weken }); // verwacht {id}
    const id  = res?.id || '';
    toast('✅ Klas opgeslagen','ok');

    const nieuw = normalizeRow({ id, naam, niveau, trainer, status, max_deelnemers, geldigheid_weken });
    allRows.push(nieuw);
    allRows.sort((a,b)=>{
      const c = collator.compare(a.naam||'', b.naam||'');
      return c || collator.compare(a.niveau||'', b.niveau||'');
    });
    renderTable(applyActiveFilter());

    if (msg) msg.textContent = `✅ Bewaard (id: ${id})`;
    form.reset();
    ensureStatusSelectDefault(); // zet status terug naar 'actief' indien nodig
    const first = form.querySelector('input,select,textarea'); first && first.focus();
  }catch(err){
    console.error(err);
    if (msg){ msg.className='error'; msg.textContent = `❌ Opslaan mislukt: ${err?.message || err}`; }
    toast('Opslaan mislukt','error');
  }
}

// ───────────────────────── Mount ─────────────────────────
async function main(){
  // Topbar
  if (window.SuperhondUI?.mount) {
    document.body.classList.add('subpage');
    window.SuperhondUI.mount({ title:'Klassen', icon:'📚', back:'../dashboard/' });
  }

  await initFromConfig();

  // status-select + form-validatie
  ensureStatusSelectDefault();
  wireAddFormValidation();

  // events
  $('#refresh')?.addEventListener('click', refresh);
  $('#search')?.addEventListener('input', doFilter);
  $('#form-add')?.addEventListener('submit', onSubmitAdd);

  // Actieknoppen (👁️ ✏️ 🗑️)
  wireActionHandlers('#tbl', {
    view:   (id)=> openKlasView(id),
    edit:   (id)=> openKlasEdit(id),
    delete: (id)=> deleteKlas(id),
  });

  // eerste load
  await refresh();

  // Enter → submit in add-form
  $$('#form-add input').forEach(inp => {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('#form-add')?.requestSubmit(); }
    });
  });
}

document.addEventListener('DOMContentLoaded', main, { once:true });
