// public/admin/admin.js — Admin tools: cfg.get/set + schema beheer
const $ = (s, r=document) => r.querySelector(s);
const $$= (s, r=document) => Array.from(r.querySelectorAll(s));

const cfgForm = $('#cfg-form');
const cfgState = $('#cfg-state');

const headersOut = $('#headers-out');
const btnLoadHeaders = $('#btn-load-headers');
const btnEnsureAll = $('#btn-ensure-all');

const ensureForm = $('#ensure-form');
const ensureState = $('#ensure-state');

const renameForm = $('#rename-form');
const renameState = $('#rename-state');

function setMsg(el, text, isErr=false){
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error', !!isErr);
  el.classList.toggle('muted', !isErr);
}

async function getJSON(url, init){
  const r = await fetch(url, init);
  const j = await r.json().catch(()=> ({}));
  if (!r.ok || j?.ok === false) {
    throw new Error(j?.error || `HTTP ${r.status}`);
  }
  return j.data;
}

/* Tabs UI */
$('#tabs')?.addEventListener('click', (e) => {
  const b = e.target.closest('.tab'); if (!b) return;
  $$('.tab').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  const name = b.dataset.tab;
  ['headers','ensure','rename'].forEach(t => {
    $('#tab-' + t).style.display = (t === name) ? '' : 'none';
  });
});

/* Config load + save */
async function loadCfg(){
  try {
    setMsg(cfgState, '⏳ Laden…');
    const data = await getJSON('../api/sheets?action=cfg.get', { cache:'no-store' });
    const apiBase = data?.apiBase || '';
    cfgForm.apiBase.value = apiBase;
    const when = data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : '—';
    setMsg(cfgState, `Huidig: ${apiBase || '—'} (laatst gewijzigd: ${when})`);
  } catch (e) {
    setMsg(cfgState, 'Fout bij laden: ' + (e?.message || e), true);
  }
}
cfgForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    setMsg(cfgState, 'Opslaan…');
    const payload = { apiBase: cfgForm.apiBase.value.trim(), token: cfgForm.token.value.trim() };
    await getJSON('../api/sheets', {
      method:'POST',
      headers:{ 'Content-Type':'text/plain' },
      body: JSON.stringify({ entity:'Config', action:'set', payload }),
    });
    setMsg(cfgState, '✔️ Opgeslagen.');
  } catch (e) {
    setMsg(cfgState, '❌ ' + (e?.message || e), true);
  }
});

/* Headers tonen */
async function loadHeaders(){
  try {
    headersOut.textContent = '⏳ Laden…';
    const data = await getJSON('../api/sheets?action=schema.get', { cache:'no-store' });
    const parts = Object.entries(data).map(([tab, hdrs]) => {
      if (!hdrs) return `• ${tab}: (geen sheet)`;
      return `• ${tab}: ${hdrs.join(', ') || '—'}`;
    });
    headersOut.textContent = parts.join('\n');
  } catch (e) {
    headersOut.textContent = '❌ ' + (e?.message || e);
    headersOut.classList.add('error');
  }
}
btnLoadHeaders?.addEventListener('click', loadHeaders);

/* Ensure all */
btnEnsureAll?.addEventListener('click', async () => {
  try {
    setMsg(headersOut, '⏳ Ensure alle tabs…');
    await getJSON('../api/sheets?action=ensureSchema', { cache:'no-store' });
    setMsg(headersOut, '✔️ Klaar.'); 
    setTimeout(loadHeaders, 300);
  } catch (e) {
    setMsg(headersOut, '❌ ' + (e?.message || e), true);
  }
});

/* Ensure specifieke tab */
ensureForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    setMsg(ensureState, '⏳ Uitvoeren…');
    const tab = ensureForm.tab.value.trim();
    const columns = ensureForm.columns.value.split(',').map(s => s.trim()).filter(Boolean);
    await getJSON('../api/sheets', {
      method:'POST',
      headers:{ 'Content-Type':'text/plain' },
      body: JSON.stringify({ entity:'Schema', action:'ensure', payload: { tab, columns } })
    });
    setMsg(ensureState, '✔️ Klaar.'); 
    setTimeout(loadHeaders, 300);
  } catch (e) {
    setMsg(ensureState, '❌ ' + (e?.message || e), true);
  }
});

/* Rename kolom */
renameForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    setMsg(renameState, '⏳ Uitvoeren…');
    const tab = renameForm.tab.value.trim();
    const from = renameForm.from.value.trim();
    const to   = renameForm.to.value.trim();
    await getJSON('../api/sheets', {
      method:'POST',
      headers:{ 'Content-Type':'text/plain' },
      body: JSON.stringify({ entity:'Schema', action:'rename', payload: { tab, from, to } })
    });
    setMsg(renameState, '✔️ Klaar.'); 
    setTimeout(loadHeaders, 300);
  } catch (e) {
    setMsg(renameState, '❌ ' + (e?.message || e), true);
  }
});

/* Boot */
document.addEventListener('DOMContentLoaded', () => {
  if (window.SuperhondUI?.mount) {
    SuperhondUI.mount({ title: 'Admin', icon: '🛡️' });
  }
  loadCfg();
  loadHeaders();
});
