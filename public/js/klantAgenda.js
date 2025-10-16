// public/js/klantagenda.js

import { initFromConfig, fetchSheet } from './sheets.js';

const $ = (s, r=document) => r.querySelector(s);

function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );
}
function toArrayRows(x){
  if (Array.isArray(x)) return x;
  if (x?.data && Array.isArray(x.data)) return x.data;
  if (x?.rows && Array.isArray(x.rows)) return x.rows;
  if (x?.result && Array.isArray(x.result)) return x.result;
  return [];
}
function normalizeLes(r){
  const o = Object.fromEntries(Object.entries(r||{}).map(([k,v])=>[String(k||'').toLowerCase(),v]));
  return {
    id:(o.id??'').toString(),
    lesnaam:(o.naam??'').toString(),
    datum:(o.datum??'').toString(),
    tijd:(o.tijd??'').toString(),
    locatie:(o.locatie??'').toString(),
    groep:(o.groep??'').toString()
  };
}
function normalizeMed(r){
  const o = Object.fromEntries(Object.entries(r||{}).map(([k,v])=>[String(k||'').toLowerCase(),v]));
  return {
    id:(o.id??'').toString(),
    inhoud:(o.inhoud??'').toString(),
    datum:(o.datum??'').toString(),
    tijd:(o.tijd??'').toString(),
    targetLes:(o.targetles??'').toString(),
    doelgroep:(o.doelgroep??'').toString(),
    categorie:(o.categorie??'').toString(),
    prioriteit:(o.prioriteit??'').toString(),
    link:(o.link??'').toString(),
    zichtbaar:String(o.zichtbaar??'').toLowerCase()!=='nee'
  };
}
const currentFilters = { categorie:'', prioriteit:'' };

function filterMededelingen(meds, opt){
  const now = new Date();
  return (meds||[]).filter(m=>{
    if (!m.zichtbaar) return false;
    if (opt.lesId && m.targetLes && m.targetLes!==opt.lesId) return false;
    if (opt.dag && m.datum && m.datum!==opt.dag) return false;
    if (opt.categorie && m.categorie && m.categorie!==opt.categorie) return false;
    if (opt.prioriteit && m.prioriteit && m.prioriteit!==opt.prioriteit) return false;
    if (m.datum){
      const dt = new Date(`${m.datum}T${m.tijd||'00:00'}`);
      if (dt < now) return false;
    }
    return true;
  });
}
function renderAgenda(lesData, medData){
  const el = $('#agenda-list');
  $('#agenda-loader')?.remove();
  if (!lesData?.length){
    el.innerHTML = `<p class="muted">Geen komende lessen.</p>`;
    return;
  }
  el.innerHTML = lesData.map(l=>{
    const meds = filterMededelingen(medData, {
      lesId:l.id, dag:l.datum,
      categorie: currentFilters.categorie,
      prioriteit: currentFilters.prioriteit
    });
    return `
      <div class="ag-punt">
        <div class="ag-header"><strong>${escapeHtml(l.lesnaam)}</strong> — ${escapeHtml(l.datum)} ${escapeHtml(l.tijd)}</div>
        <div class="info">📍 ${escapeHtml(l.locatie || 'Onbekende locatie')}</div>
        ${meds.length ? `
          <div class="mededelingen-onder ${meds.some(m=>m.prioriteit==='Hoog')?'urgent':''}">
            ${meds.map(m=>{
              const t = `${m.datum}${m.tijd?` ${m.tijd}`:''}`;
              return `<small>${escapeHtml(t)} • ${escapeHtml(m.categorie||'')}</small>${escapeHtml(m.inhoud)}${m.link?` <a href="${escapeHtml(m.link)}">[Meer]</a>`:''}`;
            }).join('<br>')}
          </div>` : '' }
      </div>`;
  }).join('');
}

// helper met timeout
const withTimeout = (p, ms, label) => Promise.race([
  p,
  new Promise((_,rej)=>setTimeout(()=>rej(new Error(`timeout:${label}`)), ms))
]);

document.addEventListener('DOMContentLoaded', async () => {
  // filters
  document.getElementById('filter-categorie')?.addEventListener('change', e => {
    currentFilters.categorie = e.target.value;
    renderAgenda(window.__lesData||[], window.__medData||[]);
  });
  document.getElementById('filter-prioriteit')?.addEventListener('change', e => {
    currentFilters.prioriteit = e.target.value;
    renderAgenda(window.__lesData||[], window.__medData||[]);
  });

  let lesData=[], medData=[];

  try{
    await withTimeout(initFromConfig(), 4000, 'init');
    try {
      const rawL = await withTimeout(fetchSheet('Lessen'), 4500, 'lessen');
      lesData = toArrayRows(rawL).map(normalizeLes);
    } catch(e){ console.warn('[Agenda] Lessen niet geladen:', e.message||e); }

    try {
      const rawM = await withTimeout(fetchSheet('Mededelingen'), 4500, 'mededelingen');
      medData = toArrayRows(rawM).map(normalizeMed);
    } catch(e){ console.warn('[Agenda] Mededelingen niet geladen:', e.message||e); }
  } catch(e){
    console.warn('[Agenda] init timeout/fout:', e.message||e);
  }

  // sort + render (ook als het leeg is)
  lesData.sort((a,b)=>(`${a.datum} ${a.tijd||''}`).localeCompare(`${b.datum} ${b.tijd||''}`));
  window.__lesData = lesData;
  window.__medData = medData;
  renderAgenda(lesData, medData);
});
