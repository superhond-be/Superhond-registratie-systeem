/**
 * public/js/instellingen.js — Centrale EXEC-URL instellen + Diagnose (v0.27.4)
 * Werkt samen met public/js/sheets.js (setBaseUrl/getBaseUrl/initFromConfig).
 */

import {
  setBaseUrl,
  getBaseUrl,
  initFromConfig,
  fetchSheet
} from '../js/sheets.js';

const LS_BRANCH = 'superhond:branch';

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

function isValidExec(u){
  try{
    const x = new URL(String(u).trim());
    return x.hostname === 'script.google.com'
        && x.pathname.startsWith('/macros/s/')
        && x.pathname.endsWith('/exec');
  }catch{ return false; }
}
function fmt(s){ return String(s ?? ''); }
function setState(txt, kind='muted'){
  const el = $('#diagState'); if(!el) return;
  el.className = kind; el.textContent = txt;
}
function writeOut(lines){
  const el = $('#diagOut'); if(!el) return;
  el.textContent = lines.join('\n');
}
function currentInfo(){
  const base = getBaseUrl() || '–';
  const branch = localStorage.getItem(LS_BRANCH) || 'production';
  $('#currentInfo').innerHTML =
    `<div><strong>EXEC:</strong> <code>${base}</code></div>
     <div><strong>Branch:</strong> ${branch}</div>`;
}

/* ---------- Tests ---------- */

async function ping(exec){
  const sep = exec.includes('?') ? '&' : '?';
  const url = `${exec}${sep}mode=ping&t=${Date.now()}`;
  const r = await fetch(url, { cache:'no-store' });
  return { ok: r.ok, status: r.status };
}

async function runDiag(){
  writeOut([]);
  setState('⏳ Testen…', 'muted');

  const exec = fmt($('#execUrl')?.value || getBaseUrl() || '');
  const branch = fmt($('#branch')?.value || localStorage.getItem(LS_BRANCH) || 'production');

  const lines = [];
  lines.push(`→ EXEC: ${exec || '(leeg)'}`);
  lines.push(`→ Branch: ${branch}`);

  if (!isValidExec(exec)){
    setState('❌ Ongeldige EXEC-URL. Vul een volledige /exec URL in.', 'error');
    writeOut([...lines, '', 'STOP: ongeldige EXEC-URL.']);
    window.SuperhondUI?.setOnline?.(false);
    return;
  }

  try{
    // 1) Ping
    lines.push('');
    lines.push(`→ ping: ${exec}?mode=ping`);
    const pr = await ping(exec);
    lines.push(`   ping: HTTP ${pr.status} ${pr.ok ? 'OK' : 'FAIL'}`);
    if (!pr.ok) throw new Error(`Ping mislukte (status ${pr.status})`);

    // 2) Klanten (mag leeg/klein zijn, het gaat om bereikbaarheid)
    lines.push('');
    lines.push(`→ klanten: ${exec}?mode=klanten`);
    const rK = await fetch(`${exec}?mode=klanten&t=${Date.now()}`, { cache:'no-store' });
    const tK = await rK.text();
    lines.push(`   klanten: HTTP ${rK.status} ${rK.ok ? 'OK' : 'FAIL'}`);
    // we tonen geen volledige data, enkel een snippet
    lines.push(`   sample: ${tK.slice(0, 140).replace(/\s+/g,' ')}…`);

    // 3) Honden
    lines.push('');
    lines.push(`→ honden: ${exec}?mode=honden`);
    const rH = await fetch(`${exec}?mode=honden&t=${Date.now()}`, { cache:'no-store' });
    const tH = await rH.text();
    lines.push(`   honden: HTTP ${rH.status} ${rH.ok ? 'OK' : 'FAIL'}`);
    lines.push(`   sample: ${tH.slice(0, 140).replace(/\s+/g,' ')}…`);

    setState('✅ Verbinding OK', 'ok');
    window.SuperhondUI?.setOnline?.(true);
  } catch (err){
    setState('❌ Diagnose faalde: ' + (err?.message || err), 'error');
    lines.push('', 'FOUT: ' + (err?.message || String(err)));
    window.SuperhondUI?.setOnline?.(false);
  } finally {
    writeOut(lines);
  }
}

/* ---------- Apply / Clear ---------- */

function doApply(){
  const raw = fmt($('#execUrl')?.value || '');
  if (!isValidExec(raw)) {
    alert('Ongeldige EXEC-URL.\nGeef de volledige /exec URL in van je Apps Script.');
    return;
  }
  setBaseUrl(raw);
  const br = fmt($('#branch')?.value || 'production');
  localStorage.setItem(LS_BRANCH, br);

  currentInfo();
  setState('✅ Opgeslagen. Je kunt nu de test uitvoeren of naar een andere pagina gaan.', 'ok');
  window.SuperhondUI?.setOnline?.(true);
}

function doClear(){
  // wist alleen de centrale instellingen (niet je data!)
  localStorage.removeItem('superhond:apiBase');
  localStorage.removeItem(LS_BRANCH);
  $('#execUrl').value = '';
  $('#branch').value = 'production';
  currentInfo();
  setState('🧹 Cache geleegd. Vul opnieuw je EXEC-URL in en klik op "Gebruik & Opslaan".', 'muted');
  writeOut([]);
  window.SuperhondUI?.setOnline?.(false);
}

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  // Topbar mount gebeurt in index.html (SuperhondUI.mount)

  // Laad bestaande config
  await initFromConfig();

  // Prefill
  $('#execUrl').value = getBaseUrl() || '';
  $('#branch').value = localStorage.getItem(LS_BRANCH) || 'production';
  currentInfo();

  // Events
  $('#btnApply')?.addEventListener('click', doApply);
  $('#btnTest') ?.addEventListener('click', runDiag);
  $('#btnClear')?.addEventListener('click', doClear);
});
