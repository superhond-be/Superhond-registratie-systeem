/**
 * public/js/diag-widget.js — Instellingen & Diagnose (v0.26.8)
 * - Beheer GAS /exec base en Branch label (localStorage)
 * - Test ping + lezen van Sheets (Klanten/Honden)
 */

import { setBaseUrl, getBaseUrl, initFromConfig, fetchSheet } from './sheets.js';

const LS_BRANCH = 'superhond:branch';

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

function setState(t, isErr=false){
  const el = $('#state'); if(!el) return;
  el.textContent = t; el.className = isErr ? 'error' : 'muted';
}
function addRow(step, ok, note){
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${step}</td><td>${ok?'OK':'ERR'}</td><td>${note||''}</td>`;
  if(!ok) tr.querySelector('td:nth-child(2)').style.color = '#b91c1c';
  $('#diag tbody').appendChild(tr);
}

async function ping(base){
  const sep = base.includes('?') ? '&':'?';
  const url = `${base}${sep}mode=ping&t=${Date.now()}`;
  try {
    const r = await fetch(url, {cache:'no-store'});
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok:false, status:'netwerk' };
  }
}

async function runDiag(){
  $('#diag tbody').innerHTML = '';
  try {
    await initFromConfig();
  } catch {}

  const base = getBaseUrl() || '';
  addRow('Basis-URL', !!base, base || 'niet ingesteld');

  if(!base){ setState('⚠️ Vul je /exec-URL in en klik “Gebruik & opslaan”.'); return; }

  const p = await ping(base);
  addRow('GAS ping', p.ok, `HTTP ${p.status}`);

  if(!p.ok){ setState('❌ Ping faalde. Controleer de /exec-URL.'); return; }

  try {
    const k = await fetchSheet('Klanten');
    addRow('Sheet:Klanten', true, `Rijen: ${(k||[]).length}`);
  } catch (e) {
    addRow('Sheet:Klanten', false, e?.message || String(e));
  }

  try {
    const h = await fetchSheet('Honden');
    addRow('Sheet:Honden', true, `Rijen: ${(h||[]).length}`);
  } catch (e) {
    addRow('Sheet:Honden', false, e?.message || String(e));
  }

  setState('✅ Diagnose klaar');
}

function saveBranch(v){
  try { v ? localStorage.setItem(LS_BRANCH, v) : localStorage.removeItem(LS_BRANCH); } catch {}
}

document.addEventListener('DOMContentLoaded', async () => {
  // Mount topbar (subpage/blauw)
  window.SuperhondUI?.mount?.({ title:'Instellingen', icon:'⚙️', back:'../dashboard/' });

  // Prefill
  $('#exec').value   = getBaseUrl() || (document.querySelector('meta[name="superhond-exec"]')?.content || '');
  $('#branch').value = (localStorage.getItem(LS_BRANCH) || document.querySelector('meta[name="superhond-branch"]')?.content || '');

  $('#apply').addEventListener('click', async () => {
    const base   = String($('#exec').value || '').trim();
    const branch = String($('#branch').value || '').trim();
    if (!base) { setState('❌ /exec-URL is verplicht', true); return; }
    setBaseUrl(base);
    saveBranch(branch);
    setState('💾 Opgeslagen. Testen…');
    await runDiag();
  });

  $('#clear').addEventListener('click', async () => {
    try { localStorage.removeItem('superhond:apiBase'); } catch {}
    try { localStorage.removeItem(LS_BRANCH); } catch {}
    $('#exec').value = ''; $('#branch').value = '';
    setState('🧹 Cache gewist.');
    $('#diag tbody').innerHTML = '';
  });

  $('#test').addEventListener('click', runDiag);

  // Automatisch direct een test uitvoeren als er al een base bestaat
  if (getBaseUrl()) { await runDiag(); }
});
