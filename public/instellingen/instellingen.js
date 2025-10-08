// Instellingen: toont Admin-sectie in admin-modus en biedt Config + Schema tools
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

/* ---------- Admin-gate (zelfde logica als dashboard admin-gate.js) ---------- */
(function gate(){
  const LS_KEY = 'superhond:admin:enabled';
  const qs = new URLSearchParams(location.search);
  if (qs.get('admin') === '1') localStorage.setItem(LS_KEY, '1');
  const enabled = localStorage.getItem(LS_KEY) === '1';
  $('#admin-section').style.display = enabled ? '' : 'none';

  // Sneltoets: Shift + Ctrl + A toggelt
  window.addEventListener('keydown', (e)=>{
    if (e.shiftKey && e.ctrlKey && e.key.toLowerCase()==='a'){
      localStorage.setItem(LS_KEY, enabled ? '0' : '1');
      location.reload();
    }
  });
})();

/* ---------- Helpers ---------- */
function setMsg(el, txt, isErr=false){
  el.textContent = txt;
  el.classList.toggle('error', !!isErr);
  el.classList.toggle('muted', !isErr);
}
async function getJSON(url, init){
  const r = await fetch(url, init);
  const j = await r.json().catch(()=>({}));
  if (!r.ok || j?.ok===false) throw new Error(j?.error || `HTTP ${r.status}`);
  return j.data;
}

/* ---------- UI refs ---------- */
const cfgForm = $('#cfg-form');
const cfgState = $('#cfg-state');

const tabs = $('#tabs');
const headersOut = $('#headers-out');
const btnLoadHeaders = $('#btn-load-headers');
const btnEnsureAll = $('#btn-ensure-all');
const ensureForm = $('#ensure-form');
const ensureState = $('#ensure-state');
const renameForm = $('#rename-form');
const renameState = $('#rename-state');

/* ---------- Tabs ---------- */
tabs?.addEventListener('click', (e)=>{
  const b = e.target.closest('.tab'); if(!b) return;
  $$('.tab').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  ['headers','ensure','rename'].forEach(t=>{
    $('#tab-'+t).style.display = (b.dataset.tab===t) ? '' : 'none';
  });
});

/* ---------- Config: load + save ---------- */
async function loadCfg(){
  try{
    setMsg(cfgState,'⏳ Laden…');
    const data = await getJSON('../api/sheets?action=cfg.get', { cache:'no-store' });
    cfgForm.apiBase.value = data?.apiBase || '';
    const when = data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : '—';
    setMsg(cfgState, `Huidig: ${data?.apiBase || '—'} (laatst gewijzigd: ${when})`);
  }catch(e){ setMsg(cfgState, '❌ '+e.message, true); }
}
cfgForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  try{
    setMsg(cfgState, 'Opslaan…');
    const body = { entity:'Config', action:'set', payload:{
      apiBase: cfgForm.apiBase.value.trim(),
      token: cfgForm.token.value.trim()
    }};
    await getJSON('../api/sheets', {
      method:'POST', headers:{ 'Content-Type':'text/plain' }, body: JSON.stringify(body)
    });
    setMsg(cfgState, '✔️ Opgeslagen.');
  }catch(e){ setMsg(cfgState, '❌ '+e.message, true); }
});

/* ---------- Schema: headers ---------- */
async function loadHeaders(){
  try{
    headersOut.textContent = '⏳ Laden…';
    const data = await getJSON('../api/sheets?action=schema.get', { cache:'no-store' });
    headersOut.textContent = Object.entries(data)
      .map(([tab,h]) => `• ${tab}: ${(h||[]).join(', ') || '—'}`).join('\n');
  }catch(e){ headersOut.textContent = '❌ '+e.message; headersOut.classList.add('error'); }
}
btnLoadHeaders?.addEventListener('click', loadHeaders);

/* ---------- Schema: ensure all ---------- */
btnEnsureAll?.addEventListener('click', async ()=>{
  const token = cfgForm.token.value.trim();
  try{
    headersOut.textContent = '⏳ Ensure alle tabs…';
    const body = { entity:'Schema', action:'ensureAll', payload:{ token } };
    await getJSON('../api/sheets', {
      method:'POST', headers:{ 'Content-Type':'text/plain' }, body: JSON.stringify(body)
    });
    headersOut.textContent = '✔️ Klaar.'; setTimeout(loadHeaders, 400);
  }catch(e){ headersOut.textContent = '❌ '+e.message; headersOut.classList.add('error'); }
});

/* ---------- Schema: ensure specifieke tab ---------- */
ensureForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const tab = ensureForm.tab.value.trim();
  const columns = ensureForm.columns.value.split(',').map(s=>s.trim()).filter(Boolean);
  const token = cfgForm.token.value.trim();
  try{
    setMsg(ensureState, '⏳ Uitvoeren…');
    const body = { entity:'Schema', action:'ensure', payload:{ tab, columns, token } };
    await getJSON('../api/sheets', {
      method:'POST', headers:{ 'Content-Type':'text/plain' }, body: JSON.stringify(body)
    });
    setMsg(ensureState, '✔️ Klaar.'); setTimeout(loadHeaders, 400);
  }catch(e){ setMsg(ensureState, '❌ '+e.message, true); }
});

/* ---------- Schema: rename ---------- */
renameForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const tab  = renameForm.tab.value.trim();
  const from = renameForm.from.value.trim();
  const to   = renameForm.to.value.trim();
  const token= cfgForm.token.value.trim();
  try{
    setMsg(renameState, '⏳ Uitvoeren…');
    const body = { entity:'Schema', action:'rename', payload:{ tab, from, to, token } };
    await getJSON('../api/sheets', {
      method:'POST', headers:{ 'Content-Type':'text/plain' }, body: JSON.stringify(body)
    });
    setMsg(renameState, '✔️ Klaar.'); setTimeout(loadHeaders, 400);
  }catch(e){ setMsg(renameState, '❌ '+e.message, true); }
});

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  if (window.SuperhondUI?.mount) {
    SuperhondUI.mount({ title: 'Instellingen', icon: '⚙️' });
  }
  loadCfg();
  loadHeaders();
});
