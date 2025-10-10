// public/js/diag.js (v0.26.6)
const $ = s => document.querySelector(s);

const state = {
  fast: $('#fastState'),
  data: $('#dataState'),
  cfg:  $('#cfgState'),
  outFast: $('#fastOut'),
  outData: $('#dataOut'),
  outCfg:  $('#cfgOut'),
  apiBaseInput: $('#apiBase'),
};

function show(el, title, payload, ok=true, code=''){
  const box = el;
  const hdr = (ok ? '✔️ ' : '❌ ') + title + (code?` (status ${code})`:'');
  const text = JSON.stringify(payload, null, 2);
  box.textContent = hdr + '\n\n' + text;
  if (ok) window.SuperhondUI?.noteSuccess?.(); else window.SuperhondUI?.noteFailure?.();
}

async function getJSON(url, init){
  const r = await fetch(url, init);
  const t = await r.text();
  let j; try{ j = JSON.parse(t); }catch{ j = { raw: t }; }
  return { ok: r.ok && j?.ok !== false, status: r.status, data: j };
}

function isExec(u){
  return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(String(u||'').trim());
}

/* ========= Snel ========= */
$('#btnPingProxy')?.addEventListener('click', async ()=>{
  state.fast.textContent = '⏳';
  const res = await getJSON('/api/sheets?action=ping', { cache:'no-store' });
  state.fast.textContent = res.ok ? 'OK' : 'FOUT';
  state.fast.className = res.ok ? 'ok' : 'err';
  show(state.outFast, 'Proxy ping', res.data, res.ok, res.status);
});

$('#btnPingGas')?.addEventListener('click', async ()=>{
  state.fast.textContent = '⏳';
  // Lees eerst /api/config → apiBase
  const cfg = await getJSON('/api/config', { cache:'no-store' });
  const base = cfg?.data?.apiBase || '';
  if (!isExec(base)) {
    state.fast.textContent = 'Geen geldige apiBase';
    state.fast.className = 'err';
    return show(state.outFast, 'GAS ping', { error:'apiBase ontbreekt' }, false, 0);
  }
  const url = new URL(base); url.searchParams.set('action', 'ping');
  try{
    const r = await fetch(url.toString(), { mode:'cors' });
    const body = await r.text();
    state.fast.textContent = r.ok ? 'OK' : 'HTTP '+r.status;
    state.fast.className = r.ok ? 'ok' : 'err';
    show(state.outFast, 'GAS ping', { body: body.slice(0, 300) }, r.ok, r.status);
  }catch(e){
    state.fast.textContent = 'Load failed';
    state.fast.className = 'err';
    show(state.outFast, 'GAS ping', { error: String(e) }, false, 0);
  }
});

/* ========= Data ========= */
$('#btnKlanten')?.addEventListener('click', async ()=>{
  state.data.textContent='⏳';
  const res = await getJSON('/api/sheets?action=getSheet&tab=Klanten', { cache:'no-store' });
  const rows = Array.isArray(res?.data) ? res.data : (res?.data?.data || []);
  state.data.textContent = res.ok ? `OK (${rows.length})` : 'FOUT';
  state.data.className = res.ok ? 'ok' : 'err';
  show(state.outData, 'Sheet: Klanten', res.data, res.ok, res.status);
});
$('#btnHonden')?.addEventListener('click', async ()=>{
  state.data.textContent='⏳';
  const res = await getJSON('/api/sheets?action=getSheet&tab=Honden', { cache:'no-store' });
  const rows = Array.isArray(res?.data) ? res.data : (res?.data?.data || []);
  state.data.textContent = res.ok ? `OK (${rows.length})` : 'FOUT';
  state.data.className = res.ok ? 'ok' : 'err';
  show(state.outData, 'Sheet: Honden', res.data, res.ok, res.status);
});

/* ========= Config ========= */
$('#btnCfgGet')?.addEventListener('click', async ()=>{
  state.cfg.textContent='⏳';
  const res = await getJSON('/api/config', { cache:'no-store' });
  if (res.ok) {
    state.cfg.textContent='OK';
    state.cfg.className='ok';
    state.apiBaseInput.value = res?.data?.apiBase || '';
  } else {
    state.cfg.textContent='FOUT';
    state.cfg.className='err';
  }
  show(state.outCfg, '/api/config', res.data, res.ok, res.status);
});

$('#btnCfgSet')?.addEventListener('click', async ()=>{
  const val = state.apiBaseInput.value.trim();
  if (!isExec(val)) {
    state.cfg.textContent='Ongeldige /exec URL';
    state.cfg.className='err';
    return;
  }
  state.cfg.textContent='⏳';
  const res = await getJSON('/api/config/set', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ apiBase: val })
  });
  state.cfg.textContent = res.ok ? 'Centraal gezet ✔️' : 'FOUT';
  state.cfg.className = res.ok ? 'ok' : 'err';
  show(state.outCfg, '/api/config/set', res.data, res.ok, res.status);
});

$('#btnCfgClear')?.addEventListener('click', async ()=>{
  state.cfg.textContent='⏳';
  const res = await getJSON('/api/config/clear', { method:'POST' });
  state.cfg.textContent = res.ok ? 'Override gewist' : 'FOUT';
  state.cfg.className = res.ok ? 'ok' : 'err';
  show(state.outCfg, '/api/config/clear', res.data, res.ok, res.status);
});

/* Auto-run: laad direct de config bij openen */
document.getElementById('btnCfgGet')?.click();
