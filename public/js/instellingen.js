// public/js/instellingen.js — v0.26.7
const LS_KEY = 'superhond:apiBase';
const $ = (s, r=document)=>r.querySelector(s);

function sanitizeExecUrl(url=''){
  try {
    const u = new URL(String(url).trim());
    if (u.hostname === 'script.google.com' &&
        u.pathname.startsWith('/macros/s/') &&
        u.pathname.endsWith('/exec')) {
      return `${u.origin}${u.pathname}`;
    }
  } catch {}
  return '';
}

function setDiag(msg, ok=null){
  const el = $('#diag'); if(!el) return;
  el.textContent = msg;
  el.classList.toggle('error', ok === false);
  el.classList.toggle('muted', ok === null);
}

async function testPing(exec){
  if (!exec) return { ok:false, note:'Geen URL' };
  const sep = exec.includes('?') ? '&' : '?';
  const url = `${exec}${sep}mode=ping&t=${Date.now()}`;
  try {
    const r = await fetch(url, { cache:'no-store' });
    return { ok:r.ok, note:`HTTP ${r.status}` };
  } catch(e){ return { ok:false, note:String(e) }; }
}

function load(){
  try {
    const v = localStorage.getItem(LS_KEY) || '';
    if ($('#exec-url')) $('#exec-url').value = v;
  } catch {}
}

function save(){
  const raw = $('#exec-url')?.value || '';
  const safe = sanitizeExecUrl(raw);
  if (!safe){ setDiag('❌ Ongeldige /exec-URL', false); return; }
  try{
    localStorage.setItem(LS_KEY, safe);
    window.SUPERHOND_SHEETS_URL = safe;
    setDiag('✔️ Bewaard. Testen…', null);
  }catch(e){ setDiag('❌ Kon niet opslaan: '+e, false); }
}

function clearCache(){
  try{
    localStorage.removeItem(LS_KEY);
    setDiag('Cache gewist. Vul opnieuw in en bewaar.', null);
  }catch{}
}

async function onTest(){
  const exec = $('#exec-url')?.value.trim();
  const { ok, note } = await testPing(exec);
  setDiag((ok?'✅ Online ':'❌ Offline ')+(note||''), ok);
  if (window.SuperhondUI)
    (ok ? SuperhondUI.noteSuccess() : SuperhondUI.noteFailure());
}

document.addEventListener('DOMContentLoaded',()=>{
  load();
  $('#btn-save') ?.addEventListener('click', e=>{e.preventDefault();save();onTest();});
  $('#btn-clear')?.addEventListener('click', e=>{e.preventDefault();clearCache();});
  $('#btn-test') ?.addEventListener('click', e=>{e.preventDefault();onTest();});
});
