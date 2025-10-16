/**
 * public/js/klassen.js — Lijst + zoeken + toevoegen (v0.27.4)
 */

import {
  initFromConfig,
  fetchSheet,
  saveKlas,
  postAction,
  getBaseUrl,
} from './sheets.js';

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

const TIMEOUT_MS = 20000;
const collator   = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

let allRows = [];
let viewRows = [];
let lastAbort = null;

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );
}
function setState(t,k='muted'){
  const el = $('#state'); if (!el) return;
  el.className = k; el.textContent = t;
  el.setAttribute('role', k==='error' ? 'alert' : 'status');
}
function toArrayRows(x){
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x && Array.isArray(x.rows)) return x.rows;
  if (x && Array.isArray(x.result)) return x.result;
  if (x && x.data && Array.isArray(x.data.rows)) return x.data.rows;
  if (x && x.ok === true && Array.isArray(x.data)) return x.data;
  return [];
}
function normalize(row){
  const o={}; for(const [k,v] of Object.entries(row||{})) o[String(k||'').toLowerCase()]=v;
  return {
    id:     (o.id ?? o['id.'] ?? o.col1 ?? '').toString(),
    naam:   (o.naam ?? '').toString(),
    niveau: (o.niveau ?? '').toString(),
    trainer:(o.trainer ?? '').toString(),
    status: (o.status ?? '').toString(),
    weeks:  (o.geldigheid_weken ?? o.weken ?? '').toString(),
    max:    (o.max_deelnemers   ?? o.capaciteit ?? '').toString(),
  };
}
function rowMatches(r,q){
  if (!q) return true;
  const hay = [r.naam, r.niveau, r.trainer, r.status]
    .map(x => String(x||'').toLowerCase()).join(' ');
  return hay.includes(q);
}

function render(rows){
  const tb = $('#tbl tbody'); if (!tb) return;
  tb.innerHTML = '';
  if (!rows.length){
    tb.innerHTML = `<tr><td colspan="7" class="muted">Geen resultaten.</td></tr>`;
    return;
  }
  const frag = document.createDocumentFragment();
  for (const r of rows){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.naam||'')}</td>
      <td>${escapeHtml(r.niveau||'')}</td>
      <td>${escapeHtml(r.trainer||'')}</td>
      <td>${escapeHtml(r.status||'')}</td>
      <td class="nowrap">${escapeHtml(r.max||'')}</td>
      <td class="nowrap">${escapeHtml(r.weeks||'')}</td>
      <td class="nowrap">
        <button class="btn btn-xs act-edit" data-id="${escapeHtml(r.id)}" title="Wijzigen">✏️</button>
        <button class="btn btn-xs danger act-del" data-id="${escapeHtml(r.id)}" title="Verwijderen">🗑️</button>
      </td>`;
    frag.appendChild(tr);
  }
  tb.appendChild(frag);
}

const doFilter = () => {
  const q = String($('#search')?.value || '').trim().toLowerCase();
  viewRows = allRows.filter(r => rowMatches(r, q));
  render(viewRows);
};

async function refresh(){
  if (lastAbort) lastAbort.abort();
  const ac = new AbortController(); lastAbort = ac;
  const t = setTimeout(() => ac.abort(new Error('timeout')), TIMEOUT_MS);

  try{
    setState('⏳ Laden…');

    const raw  = await fetchSheet('Klassen', { signal: ac.signal, timeout: TIMEOUT_MS });
    const rows = toArrayRows(raw);

    allRows = rows.map(normalize).sort((a,b)=>{
      const c = collator.compare(a.naam||'', b.naam||'');
      return c || collator.compare(a.niveau||'', b.niveau||'');
    });

    doFilter();
    setState(`✅ ${viewRows.length} klas${viewRows.length===1?'':'sen'} geladen`);
    window.SuperhondUI?.setOnline?.(true);
  } catch (e){
    if (e?.name === 'AbortError') return;
    console.error('[klassen] laden mislukt:', e);
    setState('❌ Laden mislukt: ' + (e?.message || e), 'error');
    window.SuperhondUI?.setOnline?.(false);
  } finally {
    clearTimeout(t);
  }
}

async function onSubmit(e){
  e.preventDefault();
  const f  = e.currentTarget;
  const fd = new FormData(f);

  const payload = {
    naam:     String(fd.get('naam')||'').trim(),
    niveau:   String(fd.get('niveau')||'').trim(),
    trainer:  String(fd.get('trainer')||'').trim(),
    status:   String(fd.get('status')||'').trim() || 'actief',
    max_deelnemers:    String(fd.get('max_deelnemers')||'').trim(),
    geldigheid_weken:  String(fd.get('geldigheid_weken')||'').trim(),
  };

  const msg = $('#form-msg');

  if (!payload.naam){
    if (msg){ msg.className='error'; msg.textContent='Naam is verplicht'; }
    return;
  }
  if (payload.max_deelnemers && !/^\d+$/.test(payload.max_deelnemers)){
    if (msg){ msg.className='error'; msg.textContent='Max moet een geheel getal zijn'; }
    return;
  }
  if (payload.geldigheid_weken && !/^\d+$/.test(payload.geldigheid_weken)){
    if (msg){ msg.className='error'; msg.textContent='Weken moet een geheel getal zijn'; }
    return;
  }

  if (msg){ msg.className='muted'; msg.textContent='⏳ Opslaan…'; }

  try{
    const r  = await saveKlas(payload);
    const id = r?.id || '';
    allRows.push(normalize({ id, ...payload }));
    allRows.sort((a,b)=>{
      const c = collator.compare(a.naam||'', b.naam||'');
      return c || collator.compare(a.niveau||'', b.niveau||'');
    });
    doFilter();

    f.reset();
    const sel = f.querySelector('[name="status"]'); if (sel && !sel.value) sel.value='actief';
    if (msg){ msg.textContent='✅ Bewaard'; }
  } catch (err){
    console.error('[klassen] opslaan mislukt:', err);
    if (msg){ msg.className='error'; msg.textContent='❌ Opslaan mislukt: ' + (err?.message||err); }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  window.SuperhondUI?.mount?.({ title:'Klassen', icon:'📚', back:'../dashboard/' });

  await initFromConfig();
  try { console.info('[Klassen] exec base =', getBaseUrl?.() || '(onbekend)'); } catch {}

  $('#search')?.addEventListener('input', doFilter);
  $('#refresh')?.addEventListener('click', refresh);
  $('#form-add')?.addEventListener('submit', onSubmit);

  const submitBtn = $('#form-add button, #form-add [type="submit"]');
  if (submitBtn) submitBtn.type = 'submit';

  await refresh();
});
