/**
 * public/js/honden.js — Lijst + zoeken + toevoegen (v0.27.1)
 * Werkt met sheets.js (rechtstreeks GAS)
 */

import { initFromConfig, fetchSheet, saveHond, postAction } from './sheets.js';

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

let allRows=[]; let viewRows=[];

function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function setState(t,k='muted'){const el=$('#state');if(el){el.className=k;el.textContent=t;}}
function fmtDate(iso){const s=String(iso||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const [y,m,d]=s.split('-');return `${d}/${m}/${y}`;}

function normalize(row){
  const o={}; for(const[k,v] of Object.entries(row||{})) o[String(k||'').toLowerCase()]=v;
  return {
    id:(o.id??o.hondid??o['hond id']??o['id.']??o.col1??'').toString(),
    name:(o.name??o.naam??'').toString(),
    breed:(o.breed??o.ras??'').toString(),
    birthdate:(o.birthdate??o['geboortedatum']??o.geboorte??'').toString(),
    ownerid:(o.ownerid??o['eigenaarid']??o['eigenaar (id)']??o.eigenaar??'').toString(),
    chip:(o.chip??o['chipnummer']??'').toString(),
    notes:(o.notes??o.notities??o.opm??o.opmerking??'').toString(),
    status:(o.status??'').toString()
  };
}

function rowMatches(r,q){
  if(!q) return true;
  const hay=[r.name,r.breed,r.ownerid,r.chip,r.notes,r.status].map(x=>String(x||'').toLowerCase()).join(' ');
  return hay.includes(q);
}

function render(rows){
  const tb=$('#tbl tbody'); if(!tb) return; tb.innerHTML='';
  if(!rows.length){tb.innerHTML=`<tr><td colspan="5" class="muted">Geen resultaten.</td></tr>`;return;}
  const frag=document.createDocumentFragment();
  for(const r of rows){
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${escapeHtml(r.name||'')}</td>
      <td>${escapeHtml(r.breed||'')}</td>
      <td>${escapeHtml(fmtDate(r.birthdate))}</td>
      <td class="nowrap">${escapeHtml(r.ownerid||'')}</td>
      <td class="nowrap">
        <button class="btn btn-xs act-edit" data-id="${escapeHtml(r.id)}">✏️</button>
        <button class="btn btn-xs danger act-del" data-id="${escapeHtml(r.id)}">🗑️</button>
      </td>`;
    frag.appendChild(tr);
  }
  tb.appendChild(frag);
}

const doFilter = () => {
  const q=String($('#search')?.value||'').trim().toLowerCase();
  viewRows=allRows.filter(r=>rowMatches(r,q));
  render(viewRows);
};

async function refresh(){
  try{
    setState('⏳ Laden…');
    const raw=await fetchSheet('Honden');
    const rows=Array.isArray(raw)?raw:(raw?.data||[]);
    allRows=rows.map(normalize).sort((a,b)=>collator.compare(a.name||'',b.name||''));
    doFilter();
    setState(`✅ ${viewRows.length} hond${viewRows.length===1?'':'en'} geladen`);
    window.SuperhondUI?.setOnline?.(true);
  }catch(e){
    console.error(e);
    setState('❌ Laden mislukt: '+(e?.message||e),'error');
    window.SuperhondUI?.setOnline?.(false);
  }
}

async function onSubmit(e){
  e.preventDefault();
  const f=e.currentTarget;
  const fd=new FormData(f);
  const name=String(fd.get('name')||'').trim();
  const ownerId=String(fd.get('ownerId')||'').trim();
  const breed=String(fd.get('breed')||'').trim();
  const birthdate=String(fd.get('birthdate')||'').trim();
  const chip=String(fd.get('chip')||'').trim();
  const notes=String(fd.get('notes')||'').trim();
  const status=String(fd.get('status')||'').trim()||'actief';
  if(!name || !ownerId){ $('#form-msg').className='error'; $('#form-msg').textContent='Naam en eigenaar zijn verplicht'; return; }
  try{
    const r=await saveHond({ name, ownerId, breed, birthdate, chip, notes, status });
    const id=r?.id||'';
    allRows.push(normalize({ id, name, ownerId, breed, birthdate, chip, notes, status }));
    allRows.sort((a,b)=>collator.compare(a.name||'',b.name||'')); doFilter();
    f.reset(); $('#form-msg').className='muted'; $('#form-msg').textContent='✅ Bewaard';
  }catch(err){
    console.error(err); $('#form-msg').className='error'; $('#form-msg').textContent='❌ Opslaan mislukt: '+(err?.message||err);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  window.SuperhondUI?.mount?.({ title:'Honden', icon:'🐶', back:'../dashboard/' });
  await initFromConfig();
  $('#search')?.addEventListener('input', doFilter);
  $('#refresh')?.addEventListener('click', refresh);
  $('#form-add')?.addEventListener('submit', onSubmit);
  await refresh();
});
