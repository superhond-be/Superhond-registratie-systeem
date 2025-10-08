// public/admin/admin.js — Admin interface (Config + Schema)
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

const cfgForm   = $('#cfg-form');
const cfgState  = $('#cfg-state');
const headersOut= $('#headers-out');
const ensureForm= $('#ensure-form');
const ensureState=$('#ensure-state');
const renameForm= $('#rename-form');
const renameState=$('#rename-state');

function setMsg(el, txt, isErr=false){
  el.textContent = txt;
  el.classList.toggle('error', isErr);
  el.classList.toggle('muted', !isErr);
}

async function getJSON(url, init){
  const r = await fetch(url, init);
  const j = await r.json().catch(()=>({}));
  if (!r.ok || j.ok===false) throw new Error(j.error||`HTTP ${r.status}`);
  return j.data;
}

/* Tabs */
$('#tabs')?.addEventListener('click', e=>{
  const b = e.target.closest('.tab'); if(!b) return;
  $$('.tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  ['headers','ensure','rename'].forEach(t=>{
    $('#tab-'+t).style.display=(b.dataset.tab===t)?'':'none';
  });
});

/* Config laden / opslaan */
async function loadCfg(){
  try{
    setMsg(cfgState,'⏳ Laden…');
    const data=await getJSON('../api/sheets?action=cfg.get');
    cfgForm.apiBase.value=data?.apiBase||'';
    const when=data?.updatedAt?new Date(data.updatedAt).toLocaleString():'—';
    setMsg(cfgState,`Huidig: ${data.apiBase||'—'} (laatst gewijzigd: ${when})`);
  }catch(e){setMsg(cfgState,'❌ '+e.message,true);}
}
cfgForm.addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    setMsg(cfgState,'Opslaan…');
    const body={entity:'Config',action:'set',payload:{
      apiBase:cfgForm.apiBase.value.trim(),
      token:cfgForm.token.value.trim()
    }};
    await getJSON('../api/sheets',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body)});
    setMsg(cfgState,'✔️ Opgeslagen.');
  }catch(e){setMsg(cfgState,'❌ '+e.message,true);}
});

/* Headers */
async function loadHeaders(){
  try{
    setMsg(headersOut,'⏳ Laden…');
    const data=await getJSON('../api/sheets?action=schema.get');
    headersOut.textContent=Object.entries(data).map(([t,h])=>`• ${t}: ${(h||[]).join(', ')||'—'}`).join('\n');
  }catch(e){setMsg(headersOut,'❌ '+e.message,true);}
}
$('#btn-load-headers')?.addEventListener('click',loadHeaders);
$('#btn-ensure-all')?.addEventListener('click',async()=>{
  try{setMsg(headersOut,'⏳ Ensure alle tabs…');await getJSON('../api/sheets?action=ensureSchema');setMsg(headersOut,'✔️ Klaar.');setTimeout(loadHeaders,400);}catch(e){setMsg(headersOut,'❌ '+e.message,true);}
});

/* Kolommen toevoegen */
ensureForm.addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    setMsg(ensureState,'⏳ Uitvoeren…');
    const tab=ensureForm.tab.value.trim();
    const cols=ensureForm.columns.value.split(',').map(s=>s.trim()).filter(Boolean);
    const body={entity:'Schema',action:'ensure',payload:{tab,columns:cols}};
    await getJSON('../api/sheets',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body)});
    setMsg(ensureState,'✔️ Klaar.');setTimeout(loadHeaders,400);
  }catch(e){setMsg(ensureState,'❌ '+e.message,true);}
});

/* Hernoemen */
renameForm.addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    setMsg(renameState,'⏳ Uitvoeren…');
    const body={entity:'Schema',action:'rename',payload:{
      tab:renameForm.tab.value.trim(),
      from:renameForm.from.value.trim(),
      to:renameForm.to.value.trim()
    }};
    await getJSON('../api/sheets',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body)});
    setMsg(renameState,'✔️ Klaar.');setTimeout(loadHeaders,400);
  }catch(e){setMsg(renameState,'❌ '+e.message,true);}
});

/* Start */
document.addEventListener('DOMContentLoaded',()=>{
  if(window.SuperhondUI?.mount){SuperhondUI.mount({title:'Admin',icon:'🛡️'});}
  loadCfg();loadHeaders();
});
