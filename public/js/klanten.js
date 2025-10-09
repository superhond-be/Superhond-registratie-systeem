/**
 * public/js/klanten.js — Lijst + zoeken + toevoegen + acties (v0.26.6)
 * - Voorgedrukte status-select (actief/inactief)
 * - Actiekolom (👁️ ✏️ 🗑️) via actions.js (met veilige fallback)
 * - Klik op naam opent details (met gekoppelde honden)
 * - Opslaan/Verwijderen/Wijzigen via sheets.js helpers
 */

import {
  initFromConfig,
  fetchSheet,
  saveKlant,
  postAction
} from './sheets.js';

import * as Actions from './actions.js';

// ───────────────────────── Utils ─────────────────────────
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const TIMEOUT_MS = 20000;
const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

function debounce(fn, ms = 250) { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
function toast(msg, type='info'){ (window.SuperhondToast||console.log)(msg, type); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function linkEmail(s){ const v=String(s||'').trim(); return v?`<a href="mailto:${escapeHtml(v)}">${escapeHtml(v)}</a>`:''; }
function linkTel(s){
  const v=String(s||'').trim(); if(!v) return '';
  const digits=v.replace(/[^\d+]/g,''); const href=/^\+/.test(digits)?digits:digits.replace(/^0/,'+32');
  return `<a href="tel:${escapeHtml(href)}">${escapeHtml(v)}</a>`;
}
function setState(text, kind='muted'){
  const el=$('#state'); if(!el) return;
  el.className=kind; el.textContent=text;
  el.setAttribute('role', kind==='error' ? 'alert' : 'status');
}
function clearErrors(form){ $$('.input-error',form).forEach(el=>el.classList.remove('input-error')); $$('.field-error',form).forEach(el=>el.remove()); }
function setFieldError(input,msg){
  if(!input) return;
  input.classList.add('input-error');
  const hint=document.createElement('div');
  hint.className='field-error';
  hint.textContent=msg;
  input.insertAdjacentElement('afterend', hint);
}

// ───────────────────────── Response helpers ─────────────────────────
function toArrayRows(x){
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x && Array.isArray(x.rows)) return x.rows;
  if (x && Array.isArray(x.result)) return x.result;
  if (x && x.ok === true && Array.isArray(x.data)) return x.data;
  if (x && x.data && Array.isArray(x.data.rows)) return x.data.rows;
  throw new Error('Server gaf onverwachte respons (geen lijst).');
}

// ───────────────────────── Data ─────────────────────────
let allRows = [];     // klanten
let viewRows = [];
let lastAbort = null;

// voor “Honden bij klant”
async function fetchHondenByOwner(ownerId){
  try {
    const raw = await fetchSheet('Honden', { timeout: TIMEOUT_MS });
    const list = toArrayRows(raw).map(normalizeHond);
    return list.filter(h => String(h.ownerid) === String(ownerId));
  } catch (e) {
    console.warn('[klanten] Honden laden faalde:', e?.message || e);
    return [];
  }
}

// ───────────────────────── Normalisatie ─────────────────────────
function normalizeKlant(row){
  const o = Object.create(null);
  for (const [k,v] of Object.entries(row || {})) o[String(k||'').toLowerCase()] = v;

  const id = (o.id ?? o.klantid ?? o['klant id'] ?? o['id.'] ?? o['klant_id'] ?? o.col1 ?? '').toString();
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
    status: (o.status || '').toString()
  };
}
function normalizeHond(row){
  const o={}; for(const[k,v] of Object.entries(row||{})) o[String(k||'').toLowerCase()] = v;
  return {
    id: (o.id ?? o.hondid ?? o['hond id'] ?? o['id.'] ?? o.col1 ?? '').toString(),
    name: (o.name ?? o.naam ?? '').toString(),
    breed: (o.breed ?? o.ras ?? '').toString(),
    birthdate: (o.birthdate ?? o.geboorte ?? o['geboortedatum'] ?? '').toString(),
    ownerid: (o.ownerid ?? o['ownerid'] ?? o['eigenaar id'] ?? o['eigenaarid'] ?? o.eigenaar ?? '').toString(),
    chip: (o.chip ?? o['chipnummer'] ?? '').toString(),
    notes: (o.notes ?? o.notities ?? o.opm ?? o.opmerking ?? '').toString(),
    status: (o.status || '').toString()
  };
}

// ───────────────────────── Filter/Render ─────────────────────────
function rowMatchesQuery(row, q){
  if (!q) return true;
  const hay=[row.naam,row.email,row.telefoon,row.status].map(x=>String(x||'').toLowerCase()).join(' ');
  return hay.includes(q);
}

function actionBtnsSafe({ id, entity }) {
  // Fallback als actions.js (nog) niet beschikbaar is.
  if (typeof Actions.actionBtns === 'function') return Actions.actionBtns({ id, entity });
  return `
    <div class="sh-actions">
      <button class="btn btn-xs" data-act="view" data-id="${escapeHtml(id)}" title="Bekijken">👁️</button>
      <button class="btn btn-xs" data-act="edit" data-id="${escapeHtml(id)}" title="Wijzigen">✏️</button>
      <button class="btn btn-xs danger" data-act="delete" data-id="${escapeHtml(id)}" title="Verwijderen">🗑️</button>
    </div>`;
}

function renderTable(rows){
  const tb = $('#tbl tbody'); if(!tb) return;
  tb.innerHTML='';
  if(!rows.length){ tb.innerHTML = `<tr><td colspan="5" class="muted">Geen resultaten.</td></tr>`; return; }

  const frag=document.createDocumentFragment();
  for(const r of rows){
    const tr=document.createElement('tr');
    tr.dataset.id = r.id || '';
    tr.innerHTML=`
      <td class="cell-name">
        <button class="linklike act-open" data-id="${escapeHtml(r.id||'')}" aria-label="Klant bekijken">${escapeHtml(r.naam||'')}</button>
      </td>
      <td>${linkEmail(r.email)}</td>
      <td>${linkTel(r.telefoon)}</td>
      <td>${escapeHtml(r.status||'')}</td>
      <td class="nowrap">${actionBtnsSafe({ id:r.id, entity:'klant' })}</td>
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

// ───────────────────────── Modals ─────────────────────────
function ensureModalRoot(){
  let root=document.getElementById('modal-root');
  if(!root){ root=document.createElement('div'); root.id='modal-root'; document.body.appendChild(root); }
  return root;
}
function closeModal(){ const r=document.getElementById('modal-root'); if(r) r.innerHTML=''; }
function modal(contentHTML, { title='Details' }={}){
  ensureModalRoot();
  const root=document.getElementById('modal-root');
  root.innerHTML = `
    <style>
      #modal-root .sh-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:1000}
      #modal-root .sh-modal{background:#fff;border-radius:12px;min-width:300px;max-width:760px;width:clamp(300px,92vw,760px);box-shadow:0 10px 30px rgba(0,0,0,.2)}
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
      table.sh-mini{width:100%;border-collapse:collapse;margin-top:.5rem}
      table.sh-mini th, table.sh-mini td{padding:.35rem .5rem;border-bottom:1px solid #e5e7eb}
      .linklike{appearance:none;border:none;background:none;color:#2563eb;text-decoration:underline;cursor:pointer;padding:0}
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
  root.querySelector('.sh-overlay').addEventListener('click', e=>{ if(e.target?.dataset?.close==='1') closeModal(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); }, { once:true });
}

// ───────── Bekijken (incl. honden) ─────────
async function openKlantView(id){
  const r = allRows.find(x => String(x.id) === String(id));
  if (!r) { toast('Klant niet gevonden','error'); return; }

  let honden=[];
  try { setState('Honden ophalen…','muted'); honden = await fetchHondenByOwner(r.id); }
  finally { setState(`✅ ${viewRows.length||allRows.length} klant(en) geladen`,'muted'); }

  const hondenRows = honden.length
    ? honden.map(h=>`<tr><td>${escapeHtml(h.name||'')}</td><td>${escapeHtml(h.breed||'')}</td><td>${escapeHtml(h.id||'')}</td></tr>`).join('')
    : `<tr><td colspan="3" class="muted">Geen honden gekoppeld.</td></tr>`;

  const html = `
    <div class="row"><div class="key">Naam</div><div>${escapeHtml(r.naam||'')}</div></div>
    <div class="row"><div class="key">E-mail</div><div>${r.email?`<a href="mailto:${escapeHtml(r.email)}">${escapeHtml(r.email)}</a>`:'—'}</div></div>
    <div class="row"><div class="key">Telefoon</div><div>${escapeHtml(r.telefoon||'—')}</div></div>
    <div class="row"><div class="key">Status</div><div>${escapeHtml(r.status||'—')}</div></div>
    <div class="row"><div class="key">ID</div><div><code>${escapeHtml(r.id||'')}</code></div></div>

    <h3 style="margin:.75rem 0 .25rem">Honden</h3>
    <table class="sh-mini">
      <thead><tr><th>Naam</th><th>Ras</th><th>ID</th></tr></thead>
      <tbody>${hondenRows}</tbody>
    </table>
  `;
  modal(html, { title: 'Klant bekijken' });
}

// ───────── Wijzigen ─────────
function openKlantEdit(id){
  const r = allRows.find(x => String(x.id) === String(id));
  if (!r) { toast('Klant niet gevonden','error'); return; }

  const html = `
    <form id="edit-form">
      <div class="row"><div class="key">Voornaam</div><div><input class="input" name="voornaam" value="${escapeHtml(r.voornaam||'')}" required></div></div>
      <div class="row"><div class="key">Achternaam</div><div><input class="input" name="achternaam" value="${escapeHtml(r.achternaam||'')}" required></div></div>
      <div class="row"><div class="key">E-mail</div><div><input class="input" name="email" value="${escapeHtml(r.email||'')}" type="email"></div></div>
      <div class="row"><div class="key">Telefoon</div><div><input class="input" name="telefoon" value="${escapeHtml(r.telefoon||'')}"></div></div>
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
    </form>
  `;
  modal(html, { title: 'Klant wijzigen' });

  $('#edit-form')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      id: r.id,
      voornaam:   String(fd.get('voornaam')||'').trim(),
      achternaam: String(fd.get('achternaam')||'').trim(),
      email:      String(fd.get('email')||'').trim(),
      telefoon:   String(fd.get('telefoon')||'').trim(),
      status:     String(fd.get('status')||'').trim() || 'actief'
    };

    if (!payload.voornaam || !payload.achternaam) { toast('Voornaam en achternaam zijn verplicht','error'); return; }
    if (payload.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)) { toast('Ongeldig e-mailadres','error'); return; }

    try{
      await postAction('klant','update', payload);
      Object.assign(r, normalizeKlant({ ...r, ...payload }));
      allRows.sort((a,b)=>collator.compare(a.naam||'',b.naam||''));
      renderTable(applyActiveFilter());
      toast('Wijzigingen opgeslagen','ok');
      closeModal();
    }catch(err){
      console.error(err);
      toast('Opslaan mislukt: ' + (err?.message || err),'error');
    }
  });
}

// ───────── Verwijderen ─────────
async function deleteKlant(id){
  const r = allRows.find(x => String(x.id) === String(id));
  if (!r) { toast('Klant niet gevonden','error'); return; }
  if (!confirm(`Weet je zeker dat je "${r.naam || 'deze klant'}" wil verwijderen?`)) return;

  try{
    await postAction('klant','delete', { id });
    allRows = allRows.filter(x => String(x.id)!==String(id));
    renderTable(applyActiveFilter());
    toast('Klant verwijderd','ok');
  }catch(err){
    console.error(err);
    toast('Verwijderen mislukt: ' + (err?.message || err), 'error');
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
  const ac = new AbortController(); lastAbort = ac;

  try{
    setState('⏳ Laden…','muted');

    // Probeer 'Klanten', fallback 'Leden'
    let rows;
    try { rows = toArrayRows(await fetchSheet('Klanten',{ timeout: TIMEOUT_MS, signal: ac.signal })); }
    catch { rows = toArrayRows(await fetchSheet('Leden',{ timeout: TIMEOUT_MS, signal: ac.signal })); }

    allRows = rows.map(normalizeKlant);
    allRows.sort((a,b)=>collator.compare(a.naam||'', b.naam||''));
    renderTable(applyActiveFilter());

    setState(`✅ ${viewRows.length} klant${viewRows.length===1?'':'en'} geladen`,'muted');
    window.SuperhondUI?.setOnline?.(true);
  }catch(err){
    if (err?.name === 'AbortError') return;
    console.error(err);
    setState(`❌ Fout bij laden: ${err?.message || err}`,'error');
    toast('Laden van klanten mislukt','error');
    window.SuperhondUI?.setOnline?.(false);
  }
}

// ───────────────────────── Form: nieuw klant ─────────────────────────
function ensureStatusSelectDefault(){
  const sel = document.querySelector('#form-add [name="status"]');
  if (!sel || sel.tagName !== 'SELECT') return;
  if (!sel.options || sel.options.length === 0) {
    [{v:'actief',t:'actief'},{v:'inactief',t:'inactief'}].forEach(({v,t})=>{
      const o=document.createElement('option'); o.value=v; o.textContent=t; sel.appendChild(o);
    });
  }
  sel.value = sel.value || 'actief';
}

let addBusy = false;
async function onSubmitAdd(e){
  e.preventDefault();
  if (addBusy) return; // dubbelklikken voorkomen
  addBusy = true;

  const form=e.currentTarget;
  clearErrors(form);

  const fd=new FormData(form);
  const voornaam   = String(fd.get('voornaam')||'').trim();
  const achternaam = String(fd.get('achternaam')||'').trim();
  const email      = String(fd.get('email')||'').trim();
  const telefoon   = String(fd.get('telefoon')||'').trim();
  const statusSel  = form.querySelector('[name="status"]');
  const status     = statusSel?.value || 'actief';

  let hasErr=false;
  if(!voornaam){ setFieldError(form.querySelector('[name="voornaam"]'),'Voornaam is verplicht'); hasErr=true; }
  if(!achternaam){ setFieldError(form.querySelector('[name="achternaam"]'),'Achternaam is verplicht'); hasErr=true; }
  if(email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ setFieldError(form.querySelector('[name="email"]'),'Ongeldig e-mailadres'); hasErr=true; }
  if (hasErr) { addBusy=false; return; }

  const payload={ voornaam, achternaam, email, telefoon, status };
  const msg=$('#form-msg');
  const btn = form.querySelector('button[type="submit"]') || form.querySelector('button');
  if (btn) { btn.disabled = true; }
  if(msg){ msg.className='muted'; msg.textContent='⏳ Opslaan…'; }

  try{
    const res=await saveKlant(payload);
    const id =res?.id||'';
    toast('✅ Klant opgeslagen','ok');

    const nieuw=normalizeKlant({ id, ...payload, naam: `${voornaam} ${achternaam}`.trim() });
    allRows.push(nieuw); allRows.sort((a,b)=>collator.compare(a.naam||'',b.naam||''));
    renderTable(applyActiveFilter());

    if(msg) msg.textContent=`✅ Bewaard (id: ${id})`;
    form.reset(); ensureStatusSelectDefault();
    const first=form.querySelector('input,select,textarea'); first && first.focus();
  }catch(err){
    console.error(err);
    if(msg){ msg.className='error'; msg.textContent=`❌ Opslaan mislukt: ${err?.message||err}`; }
    toast('Opslaan mislukt','error');
  } finally {
    addBusy = false;
    if (btn) { btn.disabled = false; }
  }
}

// ───────────────────────── Mount ─────────────────────────
async function main(){
  // Topbar + terugknop
  if (window.SuperhondUI?.mount) {
    document.body.classList.add('subpage');
    window.SuperhondUI.mount({ title:'Klanten', icon:'👤', back:'../dashboard/', home:false });
  }

  await initFromConfig();

  // status-select (voorgedrukt)
  ensureStatusSelectDefault();

  // events
  $('#refresh')?.addEventListener('click', refresh);
  $('#search')?.addEventListener('input', doFilter);
  $('#form-add')?.addEventListener('submit', onSubmitAdd);

  // Forceer submit type (fix “Opslaan” niet actief)
  const submitBtn = $('#form-add button, #form-add [type="submit"]');
  if (submitBtn) submitBtn.type = 'submit';

  // Actieknoppen in tabel
  if (typeof Actions.wireActionHandlers === 'function') {
    Actions.wireActionHandlers('#tbl', {
      view:   (id)=> openKlantView(id),
      edit:   (id)=> openKlantEdit(id),
      delete: (id)=> deleteKlant(id),
    });
  } else {
    // simpele fallback event-delegation
    $('#tbl')?.addEventListener('click', (e)=>{
      const b = e.target.closest('[data-act]'); if (!b) return;
      const id = b.dataset.id;
      if (b.dataset.act === 'view') return openKlantView(id);
      if (b.dataset.act === 'edit') return openKlantEdit(id);
      if (b.dataset.act === 'delete') return deleteKlant(id);
    });
  }

  // Klik op naam => bekijken
  $('#tbl')?.addEventListener('click', (e)=>{
    const b = e.target.closest('.act-open'); if (!b) return;
    openKlantView(b.dataset.id);
  });

  // Enter → submit
  $$('#form-add input').forEach(inp=>{
    inp.addEventListener('keydown',(e)=>{
      if(e.key==='Enter'){ e.preventDefault(); $('#form-add')?.requestSubmit(); }
    });
  });

  await refresh();
}
document.addEventListener('DOMContentLoaded', main, { once:true });
