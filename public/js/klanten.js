/**
 * public/js/klanten.js — Lijst + zoeken + toevoegen (v0.27.1)
 * Werkt met sheets.js (rechtstreeks GAS)
 */

import { initFromConfig, fetchSheet, saveKlant, postAction } from './sheets.js';

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

let allRows = [];
let viewRows = [];

function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function linkEmail(s){const v=String(s||'').trim();return v?`<a href="mailto:${escapeHtml(v)}">${escapeHtml(v)}</a>`:'';}
function linkTel(s){const v=String(s||'').trim();if(!v)return'';const href=v.replace(/\s+/g,'');return `<a href="tel:${escapeHtml(href)}">${escapeHtml(v)}</a>`;}
function setState(t,kind='muted'){const el=$('#state');if(el){el.className=kind;el.textContent=t;}}
function clearErrors(f){$$('.input-error',f).forEach(x=>x.classList.remove('input-error'));$$('.field-error',f).forEach(x=>x.remove());}
function setFieldError(inp,msg){if(!inp)return;inp.classList.add('input-error');const d=document.createElement('div');d.className='field-error';d.textContent=msg;inp.insertAdjacentElement('afterend',d);}

function normalize(row){
  const o={}; for(const[k,v] of Object.entries(row||{})) o[String(k||'').toLowerCase()]=v;
  const id=(o.id??o.klantid??o['klant id']??o['id.']??o['klant_id']??o.col1??'').toString();
  const vn=(o.voornaam||'').toString().trim();
  const an=(o.achternaam||'').toString().trim();
  return {
    id, voornaam:vn, achternaam:an,
    naam: (o.naam || `${vn} ${an}`.trim()).toString(),
    email:(o.email||'').toString(),
    telefoon:(o.telefoon||o.gsm||'').toString(),
    status:(o.status||'').toString()
  };
}

function rowMatches(r,q){
  if(!q) return true;
  const hay=[r.naam,r.email,r.telefoon,r.status].map(x=>String(x||'').toLowerCase()).join(' ');
  return hay.includes(q);
}

function render(rows){
  const tb=$('#tbl tbody'); if(!tb) return;
  tb.innerHTML='';
  if(!rows.length){tb.innerHTML=`<tr><td colspan="5" class="muted">Geen resultaten.</td></tr>`;return;}
  const frag=document.createDocumentFragment();
  for(const r of rows){
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${escapeHtml(r.naam||'')}</td>
      <td>${linkEmail(r.email)}</td>
      <td>${linkTel(r.telefoon)}</td>
      <td>${escapeHtml(r.status||'')}</td>
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
    const raw=await fetchSheet('Klanten');
    const rows=Array.isArray(raw)?raw:(raw?.data||[]);
    allRows=rows.map(normalize).sort((a,b)=>collator.compare(a.naam||'',b.naam||''));
    doFilter();
    setState(`✅ ${viewRows.length} klant${viewRows.length===1?'':'en'} geladen`);
    window.SuperhondUI?.setOnline?.(true);
  }catch(e){
    console.error(e);
    setState('❌ Laden mislukt: '+(e?.message||e),'error');
    window.SuperhondUI?.setOnline?.(false);
  }
}

async function onSubmit(e){
  e.preventDefault();
  const f=e.currentTarget; clearErrors(f);
  const fd=new FormData(f);
  const voornaam=String(fd.get('voornaam')||'').trim();
  const achternaam=String(fd.get('achternaam')||'').trim();
  const email=String(fd.get('email')||'').trim();
  const tel=String(fd.get('telefoon')||'').trim();
  const status=String(fd.get('status')||'').trim()||'actief';

  let bad=false;
  if(!voornaam){setFieldError(f.querySelector('[name="voornaam"]'),'Voornaam is verplicht');bad=true;}
  if(!achternaam){setFieldError(f.querySelector('[name="achternaam"]'),'Achternaam is verplicht');bad=true;}
  if(email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){setFieldError(f.querySelector('[name="email"]'),'Ongeldig e-mailadres');bad=true;}
  if(bad) return;

  try{
    const r=await saveKlant({voornaam,achternaam,email,telefoon:tel,status});
    const id=r?.id||'';
    allRows.push(normalize({id,voornaam,achternaam,email,telefoon:tel,status}));
    allRows.sort((a,b)=>collator.compare(a.naam||'',b.naam||''));
    doFilter();
    f.reset();
    $('#form-msg').textContent='✅ Bewaard';
  }catch(err){
    console.error(err);
    $('#form-msg').className='error';
    $('#form-msg').textContent='❌ Opslaan mislukt: '+(err?.message||err);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  window.SuperhondUI?.mount?.({ title:'Klanten', icon:'👤', back:'../dashboard/' });
  await initFromConfig();
  $('#search')?.addEventListener('input', doFilter);
  $('#refresh')?.addEventListener('click', refresh);
  $('#form-add')?.addEventListener('submit', onSubmit);
  await refresh();
});
