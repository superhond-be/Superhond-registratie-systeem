/* v0.22.3 — Hondenpagina (robuste fetch + search + form + toasts)
   - Leest via proxy:   GET  /api/sheets?mode=honden
   - Opslaan (optioneel): POST /api/sheets?mode=saveHond   (GAS moet dit ondersteunen)
   - Mooie foutmeldingen + toasts + defensieve parsing
*/

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

/* ───────── Toast helper ───────── */
function toast(msg, type='info'){ (window.SuperhondToast||console.log)(msg, type); }

/* ───────── State ───────── */
let ALL = [];          // volledige lijst honden (from backend)
let VIEW = [];         // gefilterde lijst
let loading = false;

/* ───────── DOM refs ───────── */
const els = {
  state:   $('#state'),
  table:   $('#tbl'),
  tbody:   $('#tbl tbody'),
  search:  $('#search'),
  refresh: $('#refresh'),

  form:    $('#form-add'),
  formMsg: $('#form-msg')
};

/* ───────── Utils ───────── */
function setMsg(el, txt, err=false){
  if (!el) return;
  el.textContent = txt || '';
  el.style.display = txt ? '' : 'none';
  el.classList.toggle('error', !!err);
  el.classList.toggle('muted', !err);
}
function norm(v){ return String(v==null?'':v).trim().toLowerCase(); }
function safeDate(d){
  // accepteer Date of yyyy-mm-dd, anders leeg
  try{
    if (!d) return '';
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt)) return '';
    return dt.toLocaleDateString();
  }catch{ return ''; }
}

/* ───────── API ───────── */
async function getJSON(url, init){
  const r = await fetch(url, init);
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!r.ok) {
    const peek = (text||'').slice(0,150).replace(/\s+/g,' ');
    throw new Error(`${r.status} ${r.statusText}${peek?` — ${peek}`:''}`);
  }
  if (!json || json.ok === false) {
    throw new Error(json?.error || 'Ongeldige JSON van server');
  }
  return json.data;
}

async function fetchDogs(){
  return await getJSON('../api/sheets?mode=honden', { cache:'no-store' });
}

async function saveDog(payload){
  // Alleen proberen wanneer je GAS dit ondersteunt (mode=saveHond)
  return await getJSON('../api/sheets?mode=saveHond', {
    method:'POST',
    headers:{ 'Content-Type':'text/plain' },
    body: JSON.stringify(payload)
  });
}

/* ───────── Rendering ───────── */
function renderRows(list){
  els.tbody.innerHTML = '';
  if (!list?.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'muted';
    td.textContent = 'Geen resultaten.';
    tr.appendChild(td);
    els.tbody.appendChild(tr);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const d of list) {
    const tr = document.createElement('tr');

    const naam    = d.naam || d.name || '';
    const ras     = d.ras || d.breed || '';
    const geboort = d.geboorte || d.birthdate || '';
    const eigenaar= d.eigenaar || d.ownerid || d.ownerId || '';
    const id      = d.id || '';

    tr.innerHTML = `
      <td>${naam}</td>
      <td>${ras}</td>
      <td>${safeDate(geboort)}</td>
      <td class="nowrap">${eigenaar}</td>
      <td class="nowrap">
        <!-- plaats voor acties -->
      </td>
    `;
    tr.dataset.id = id;
    frag.appendChild(tr);
  }
  els.tbody.appendChild(frag);
}

/* ───────── Filtering ───────── */
function applyFilter(){
  const q = norm(els.search?.value);
  if (!q) {
    VIEW = [...ALL];
  } else {
    VIEW = ALL.filter(d => {
      const naam    = norm(d.naam || d.name);
      const ras     = norm(d.ras || d.breed);
      const eigenaar= norm(d.eigenaar || d.ownerid || d.ownerId);
      const chip    = norm(d.chip || d.chipnummer);
      const notes   = norm(d.notes || d.notities);
      return [naam, ras, eigenaar, chip, notes].some(v => v.includes(q));
    });
  }
  renderRows(VIEW);
}

/* ───────── Actions ───────── */
async function refresh(){
  if (loading) return;
  loading = true;
  setMsg(els.state, '⏳ Laden…');

  try{
    const data = await fetchDogs();
    // defensief: data kan array of object {rows:[]}
    const rows = Array.isArray(data) ? data : (Array.isArray(data?.rows) ? data.rows : []);
    ALL = rows;
    setMsg(els.state, `✔️ ${rows.length} hond${rows.length===1?'':'en'}`);
    applyFilter();
  }catch(e){
    console.error(e);
    setMsg(els.state, 'Fout bij laden honden: '+ e.message, true);
    toast('❌ Laden van honden mislukt: '+ e.message, 'warn');
    ALL = [];
    applyFilter();
  }finally{
    loading = false;
  }
}

function getFormData(form){
  const fd = new FormData(form);
  const obj = Object.fromEntries(fd.entries());
  // normaliseer keynamen richting GAS
  return {
    name:      (obj.name || obj.naam || '').trim(),
    breed:     (obj.breed || obj.ras || '').trim(),
    birthdate: (obj.birthdate || obj.geboorte || '').trim(),
    ownerId:   (obj.ownerId || obj.ownerid || obj.eigenaar || obj['eigenaar id'] || '').trim(),
    chip:      (obj.chip || obj.chipnummer || '').trim(),
    notes:     (obj.notes || obj.notities || '').trim()
  };
}

async function onSubmit(e){
  e.preventDefault();
  const payload = getFormData(els.form);

  // simpele client-validatie
  if (!payload.name)  return showFieldError('name', 'Naam is verplicht');
  if (!payload.ownerId) return showFieldError('ownerId', 'Eigenaar ID is verplicht');

  setMsg(els.formMsg, '⏳ Opslaan…');
  try{
    await saveDog(payload);
    setMsg(els.formMsg, '');
    els.form.reset();
    toast('🐶 Nieuwe hond opgeslagen', 'ok');
    await refresh();
  }catch(e){
    setMsg(els.formMsg, '❌ Opslaan mislukt: '+e.message, true);
    toast('❌ Opslaan mislukt: '+e.message, 'warn');
  }
}

function showFieldError(name, msg){
  setMsg(els.formMsg, msg, true);
  const field = els.form?.querySelector(`[name="${name}"]`);
  if (field) {
    field.classList.add('input-error');
    field.focus();
    field.addEventListener('input', () => field.classList.remove('input-error'), { once:true });
  }
}

/* ───────── Wire-up ───────── */
function wire(){
  els.search?.addEventListener('input', () => applyFilter());
  els.refresh?.addEventListener('click', refresh);
  els.form?.addEventListener('submit', onSubmit);
}

/* ───────── Boot ───────── */
document.addEventListener('DOMContentLoaded', async () => {
  wire();
  await refresh();

  // kleine UX: Enter in zoekveld triggert refresh
  els.search?.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter') { e.preventDefault(); refresh(); }
  });
});
