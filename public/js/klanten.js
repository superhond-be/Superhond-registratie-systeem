/**
 * public/js/klanten.js — Lijst + zoeken + toevoegen + acties (v0.27.4)
 * - Zelfde stijl als honden.js: één exec-bron via sheets.js
 * - Robuuste parsing, timeout/abort, console-log van exec-base
 */

import {
  initFromConfig,
  fetchSheet,
  saveKlant,
  postAction,
  getBaseUrl,     // enkel voor debug/log
} from './sheets.js';

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

const TIMEOUT_MS = 20000;
const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

let allRows = [];
let viewRows = [];
let lastAbort = null;

/* ---------- helpers ---------- */
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
  const o={}; for (const [k,v] of Object.entries(row||{})) o[String(k||'').toLowerCase()]=v;
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
    status: (o.status || '').toString(),
  };
}
function rowMatches(r, q){
  if (!q) return true;
  const hay = [r.naam, r.email, r.telefoon, r.status]
    .map(x => String(x||'').toLowerCase()).join(' ');
  return hay.includes(q);
}

/* ---------- render ---------- */
function render(rows){
  const tb = $('#tbl tbody'); if (!tb) return;
  tb.innerHTML = '';
  if (!rows.length){
    tb.innerHTML = `<tr><td colspan="5" class="muted">Geen resultaten.</td></tr>`;
    return;
  }
  const frag = document.createDocumentFragment();
  for (const r of rows){
    const tr = document.createElement('tr');
    tr.dataset.id = r.id || '';
    tr.innerHTML = `
      <td>${escapeHtml(r.naam||'')}</td>
      <td>${r.email ? `<a href="mailto:${escapeHtml(r.email)}">${escapeHtml(r.email)}</a>` : ''}</td>
      <td>${escapeHtml(r.telefoon||'')}</td>
      <td>${escapeHtml(r.status||'')}</td>
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

/* ---------- data ---------- */
async function refresh(){
  if (lastAbort) lastAbort.abort();
  const ac = new AbortController(); lastAbort = ac;
  const t = setTimeout(() => ac.abort(new Error('timeout')), TIMEOUT_MS);

  try{
    setState('⏳ Laden…');

    // Probeer 'Klanten', val terug op 'Leden'
    let rows = [];
    try {
      rows = toArrayRows(await fetchSheet('Klanten', { signal: ac.signal, timeout: TIMEOUT_MS }));
    } catch {
      rows = toArrayRows(await fetchSheet('Leden',   { signal: ac.signal, timeout: TIMEOUT_MS }));
    }

    allRows = rows.map(normalize).sort((a,b)=>collator.compare(a.naam||'', b.naam||''));
    doFilter();

    setState(`✅ ${viewRows.length} klant${viewRows.length===1?'':'en'} geladen`);
    window.SuperhondUI?.setOnline?.(true);
  } catch (e){
    if (e?.name === 'AbortError') return;
    console.error('[klanten] laden mislukt:', e);
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
    voornaam:   String(fd.get('voornaam')||'').trim(),
    achternaam: String(fd.get('achternaam')||'').trim(),
    email:      String(fd.get('email')||'').trim(),
    telefoon:   String(fd.get('telefoon')||'').trim(),
    status:     String(fd.get('status')||'').trim() || 'actief',
  };

  const msg = $('#form-msg');

  if (!payload.voornaam || !payload.achternaam){
    if (msg){ msg.className='error'; msg.textContent='Voornaam en achternaam zijn verplicht'; }
    return;
  }
  if (payload.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)){
    if (msg){ msg.className='error'; msg.textContent='Ongeldig e-mailadres'; }
    return;
  }

  if (msg){ msg.className='muted'; msg.textContent='⏳ Opslaan…'; }

  try{
    const r  = await saveKlant(payload); // verwacht { id }
    const id = r?.id || '';
    allRows.push(normalize({ id, naam: `${payload.voornaam} ${payload.achternaam}`.trim(), ...payload }));
    allRows.sort((a,b)=>collator.compare(a.naam||'', b.naam||''));
    doFilter();

    f.reset();
    const sel = f.querySelector('[name="status"]'); if (sel && !sel.value) sel.value = 'actief';
    if (msg){ msg.textContent='✅ Bewaard'; }
  } catch (err){
    console.error('[klanten] opslaan mislukt:', err);
    if (msg){ msg.className='error'; msg.textContent='❌ Opslaan mislukt: ' + (err?.message||err); }
  }
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  window.SuperhondUI?.mount?.({ title:'Klanten', icon:'👤', back:'../dashboard/' });

  await initFromConfig();
  try { console.info('[Klanten] exec base =', getBaseUrl?.() || '(onbekend)'); } catch {}

  $('#search')?.addEventListener('input', doFilter);
  $('#refresh')?.addEventListener('click', refresh);
  $('#form-add')?.addEventListener('submit', onSubmit);

  const submitBtn = $('#form-add button, #form-add [type="submit"]');
  if (submitBtn) submitBtn.type = 'submit';

  await refresh();
});
