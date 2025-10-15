/**
 * public/js/honden.js — Lijst + zoeken + toevoegen (v0.27.3)
 * - Leest exec-URL via sheets.js (localStorage/meta) → 1 bron voor alles
 * - Robuuste respons parsing (toArrayRows)
 * - Timeout + abort bij refresh
 * - Console-logt welke exec-basis gebruikt wordt (1x)
 */

import {
  initFromConfig,
  fetchSheet,
  saveHond,
  postAction,
  getBaseUrl,        // alleen voor debug/log in console
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
function setState(t, k='muted'){
  const el = $('#state'); if (!el) return;
  el.className = k; el.textContent = t;
  el.setAttribute('role', k === 'error' ? 'alert' : 'status');
}
function fmtDate(iso){
  const s = String(iso || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`;
}

/** vangt verschillende responsvormen op en geeft altijd een array terug */
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
    id:        (o.id ?? o.hondid ?? o['hond id'] ?? o['id.'] ?? o.col1 ?? '').toString(),
    name:      (o.name ?? o.naam ?? '').toString(),
    breed:     (o.breed ?? o.ras ?? '').toString(),
    birthdate: (o.birthdate ?? o['geboortedatum'] ?? o.geboorte ?? '').toString(),
    ownerid:   (o.ownerid ?? o['eigenaarid'] ?? o['eigenaar (id)'] ?? o.eigenaar ?? '').toString(),
    chip:      (o.chip ?? o['chipnummer'] ?? '').toString(),
    notes:     (o.notes ?? o.notities ?? o.opm ?? o.opmerking ?? '').toString(),
    status:    (o.status ?? '').toString(),
  };
}

function rowMatches(r,q){
  if (!q) return true;
  const hay = [r.name, r.breed, r.ownerid, r.chip, r.notes, r.status]
    .map(x => String(x||'').toLowerCase())
    .join(' ');
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
    tr.innerHTML = `
      <td>${escapeHtml(r.name || '')}</td>
      <td>${escapeHtml(r.breed || '')}</td>
      <td>${escapeHtml(fmtDate(r.birthdate))}</td>
      <td class="nowrap">${escapeHtml(r.ownerid || '')}</td>
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
  // aborteer vorige refresh indien nog bezig
  if (lastAbort) lastAbort.abort();
  const ac = new AbortController(); lastAbort = ac;

  // eigen timeout
  const t = setTimeout(() => ac.abort(new Error('timeout')), TIMEOUT_MS);

  try{
    setState('⏳ Laden…');

    const raw = await fetchSheet('Honden', { signal: ac.signal, timeout: TIMEOUT_MS });
    const rows = toArrayRows(raw);

    allRows = rows.map(normalize)
                  .sort((a,b) => collator.compare(a.name || '', b.name || ''));

    doFilter();
    setState(`✅ ${viewRows.length} hond${viewRows.length===1?'':'en'} geladen`);
    window.SuperhondUI?.setOnline?.(true);
  } catch (e){
    if (e?.name === 'AbortError') return;
    console.error('[honden] laden mislukt:', e);
    setState('❌ Laden mislukt: ' + (e?.message || e), 'error');
    window.SuperhondUI?.setOnline?.(false);
  } finally {
    clearTimeout(t);
  }
}

async function onSubmit(e){
  e.preventDefault();
  const f = e.currentTarget;
  const fd = new FormData(f);

  const payload = {
    name:      String(fd.get('name')||'').trim(),
    ownerId:   String(fd.get('ownerId')||'').trim(),
    breed:     String(fd.get('breed')||'').trim(),
    birthdate: String(fd.get('birthdate')||'').trim(),
    chip:      String(fd.get('chip')||'').trim(),
    notes:     String(fd.get('notes')||'').trim(),
    status:    String(fd.get('status')||'').trim() || 'actief',
  };

  if (!payload.name || !payload.ownerId){
    const msg = $('#form-msg');
    if (msg){ msg.className='error'; msg.textContent='Naam en eigenaar zijn verplicht'; }
    return;
  }

  const msg = $('#form-msg');
  if (msg){ msg.className='muted'; msg.textContent='⏳ Opslaan…'; }

  try{
    const r  = await saveHond(payload);       // verwacht { id }
    const id = r?.id || '';
    allRows.push(normalize({ id, ...payload }));
    allRows.sort((a,b)=>collator.compare(a.name||'', b.name||''));
    doFilter();

    f.reset();
    if (msg){ msg.className='muted'; msg.textContent='✅ Bewaard'; }
  } catch (err){
    console.error('[honden] opslaan mislukt:', err);
    if (msg){ msg.className='error'; msg.textContent='❌ Opslaan mislukt: ' + (err?.message||err); }
  }
}

/* ---------- bootstrapping ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  // Topbar + terug
  window.SuperhondUI?.mount?.({ title:'Honden', icon:'🐶', back:'../dashboard/' });

  // Config ophalen (zet exec-basis vanuit localStorage/meta)
  await initFromConfig();

  // Debug: toon gebruikte exec-basis in de console (handig bij inconsistenties)
  try { console.info('[Honden] exec base =', getBaseUrl?.() || '(onbekend)'); } catch {}

  // events
  $('#search')?.addEventListener('input', doFilter);
  $('#refresh')?.addEventListener('click', refresh);
  $('#form-add')?.addEventListener('submit', onSubmit);

  // eerste load
  await refresh();
});
