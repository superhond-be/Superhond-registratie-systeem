/**
 * public/js/agenda.js — Dashboard badges + agenda (v0.27.3)
 * - Zelfde init/exec-bron als andere pagina's
 * - Telt actieve Klassen/Reeksen; (optioneel) vult agenda-tabel wanneer beschikbaar
 */

import {
  initFromConfig,
  fetchSheet,
  getBaseUrl,   // voor debug/log
} from './sheets.js';

const $  = (s, r=document) => r.querySelector(s);

const TIMEOUT_MS = 20000;

function toArrayRows(x){
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x && Array.isArray(x.rows)) return x.rows;
  if (x && Array.isArray(x.result)) return x.result;
  if (x && x.data && Array.isArray(x.data.rows)) return x.data.rows;
  if (x && x.ok === true && Array.isArray(x.data)) return x.data;
  return [];
}
const norm = (s) => String(s==null?'':s).trim().toLowerCase();

async function updateBadges(){
  try{
    const [klassenRaw, reeksenRaw] = await Promise.all([
      fetchSheet('Klassen', { timeout: TIMEOUT_MS }),
      fetchSheet('Reeksen', { timeout: TIMEOUT_MS }).catch(()=>[])
    ]);
    const klassen = toArrayRows(klassenRaw);
    const reeksen = toArrayRows(reeksenRaw);

    const actKl = klassen.filter(k => norm(k.status)==='actief').length;
    const actRs = reeksen.filter(r => norm(r.status)==='actief').length;

    const kb = $('#klassen-badge'); if (kb) kb.textContent = String(actKl);
    const ks = $('#klassen-sub');   if (ks) ks.textContent = actKl ? `${actKl} actief` : '—';

    const rb = $('#reeksen-badge'); if (rb) rb.textContent = String(actRs);
    const rs = $('#reeksen-sub');   if (rs) rs.textContent = actRs ? `${actRs} actief` : '—';
  } catch (e){
    console.warn('[agenda] badges updaten faalde:', e?.message || e);
  }
}

// (optioneel) agenda weergave: vul je eigen kolommen in als je die in GAS voorziet
async function fillAgenda(){
  const wrap = $('#agenda-table-wrap');
  const body = $('#agenda-table tbody');
  const loader = $('#agenda-loader');
  const err    = $('#agenda-error');
  if (!wrap || !body) return;

  loader && (loader.style.display = '');
  err && (err.style.display = 'none');
  wrap.style.display = 'none';

  try{
    // Voorbeeld: haal 'Agenda' tab als die bestaat
    const raw = await fetchSheet('Agenda', { timeout: TIMEOUT_MS });
    const rows = toArrayRows(raw);

    body.innerHTML = '';
    if (!rows.length){
      body.innerHTML = `<tr><td colspan="4" class="muted">Geen items.</td></tr>`;
    } else {
      for (const r of rows){
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r.naam||r.title||''}</td>
          <td>${r.datum||r.date||''}</td>
          <td>${r.locatie||r.location||''}</td>
          <td>${r.trainers||r.trainer||''}</td>`;
        body.appendChild(tr);
      }
    }
    wrap.style.display = '';
  } catch (e){
    console.error('[agenda] laden faalde:', e);
    if (err){ err.textContent = '❌ Laden faalde: ' + (e?.message||e); err.style.display=''; }
  } finally {
    loader && (loader.style.display = 'none');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Topbar (geel) wordt al via dashboard/index.html + layout.js gezet
  await initFromConfig();
  try { console.info('[Dashboard] exec base =', getBaseUrl?.() || '(onbekend)'); } catch {}

  updateBadges();
  fillAgenda(); // als je (nog) geen 'Agenda' tab hebt in je sheet, mag je dit uitzetten
});
