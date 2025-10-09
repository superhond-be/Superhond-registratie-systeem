/**
 * public/instellingen/instellingen.js — Instellingen + Admin (Config & Schema)
 * Versie 0.22.0 — opgeschoond en geoptimaliseerd
 * - Uniforme Superhond-look
 * - Admin-sectie automatisch afgeschermd
 * - Betere foutmeldingen en statusfeedback
 */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ─────────── Toast helper ─────────── */
function toast(msg, type = 'info') {
  if (typeof window.SuperhondToast === 'function') {
    window.SuperhondToast(msg, type);
  } else {
    console[(type === 'error' ? 'error' : 'log')](msg);
  }
}

/* ─────────── Admin-gate ─────────── */
(function adminGate() {
  const LS_KEY = 'superhond:admin:enabled';
  const qs = new URLSearchParams(location.search);
  if (qs.get('admin') === '1') localStorage.setItem(LS_KEY, '1');
  const isAdmin = localStorage.getItem(LS_KEY) === '1';

  const adminSection = $('#admin-section');
  if (adminSection) adminSection.style.display = isAdmin ? '' : 'none';

  if (!isAdmin) {
    console.info('🔒 Geen admin-rechten — adminsectie verborgen.');
  }
})();

/* ─────────── Gebruikersinstellingen ─────────── */
const LS_THEME   = 'superhond:theme';
const LS_DENSITY = 'superhond:density';

const selTheme   = $('#theme');
const selDensity = $('#density');
const btnSave    = $('#btnSave');
const btnReset   = $('#btnReset');
const saveState  = $('#saveState');

function setMsg(el, txt, isErr = false) {
  if (!el) return;
  el.textContent = txt;
  el.classList.toggle('error', !!isErr);
  el.classList.toggle('muted', !isErr);
}

function applyPrefs(theme, density) {
  document.documentElement.setAttribute('data-density', density || 'normal');
  document.body.dataset.theme = theme || 'light'; // voorbereid voor dark mode
}

function loadPrefs() {
  const theme = localStorage.getItem(LS_THEME) || 'light';
  const density = localStorage.getItem(LS_DENSITY) || 'normal';
  if (selTheme) selTheme.value = theme;
  if (selDensity) selDensity.value = density;
  applyPrefs(theme, density);
}

function savePrefs() {
  localStorage.setItem(LS_THEME, selTheme.value);
  localStorage.setItem(LS_DENSITY, selDensity.value);
  applyPrefs(selTheme.value, selDensity.value);
  setMsg(saveState, '✔️ Instellingen bewaard.');
  toast('⚙️ Instellingen opgeslagen', 'ok');
  setTimeout(() => setMsg(saveState, ''), 1200);
}

function resetPrefs() {
  localStorage.removeItem(LS_THEME);
  localStorage.removeItem(LS_DENSITY);
  if (selTheme) selTheme.value = 'light';
  if (selDensity) selDensity.value = 'normal';
  applyPrefs('light', 'normal');
  setMsg(saveState, '↩️ Standaardinstellingen hersteld.');
  toast('Standaardinstellingen hersteld', 'info');
  setTimeout(() => setMsg(saveState, ''), 1200);
}

btnSave?.addEventListener('click', savePrefs);
btnReset?.addEventListener('click', resetPrefs);
loadPrefs();

/* ─────────── Helpers voor API-calls ─────────── */
async function getJSON(url, init) {
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
  return j.data;
}

/* ─────────── Admin: Config + Schema ─────────── */
const cfgForm    = $('#cfg-form');
const cfgState   = $('#cfg-state');
const tabs       = $('#tabs');
const headersOut = $('#headers-out');
const btnLoadHeaders = $('#btn-load-headers');
const btnEnsureAll   = $('#btn-ensure-all');
const ensureForm = $('#ensure-form');
const ensureState= $('#ensure-state');
const renameForm = $('#rename-form');
const renameState= $('#rename-state');

/* Tabswitching */
tabs?.addEventListener('click', e => {
  const b = e.target.closest('.tab');
  if (!b) return;
  $$('.tab').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  ['headers', 'ensure', 'rename'].forEach(t => {
    $('#tab-' + t).style.display = (b.dataset.tab === t) ? '' : 'none';
  });
});

/* Config laden + opslaan */
async function loadCfg() {
  try {
    setMsg(cfgState, '⏳ Config laden…');
    const data = await getJSON('../api/sheets?action=cfg.get', { cache: 'no-store' });
    if (!data) throw new Error('Geen config ontvangen');
    cfgForm.apiBase.value = data?.apiBase || '';
    const when = data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : '—';
    setMsg(cfgState, `🌐 ${data?.apiBase || '—'} (laatst gewijzigd: ${when})`);
  } catch (e) {
    setMsg(cfgState, '❌ ' + e.message, true);
  }
}

cfgForm?.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    setMsg(cfgState, '⏳ Opslaan…');
    const body = {
      entity: 'Config',
      action: 'set',
      payload: {
        apiBase: cfgForm.apiBase.value.trim(),
        token: cfgForm.token.value.trim()
      }
    };
    await getJSON('../api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body)
    });
    setMsg(cfgState, '✔️ Config opgeslagen.');
    toast('🔧 Config opgeslagen', 'ok');
  } catch (e) {
    setMsg(cfgState, '❌ ' + e.message, true);
    toast('❌ Config opslaan mislukt: ' + e.message, 'error');
  }
});

/* Schema: headers tonen */
async function loadHeaders() {
  try {
    headersOut.textContent = '⏳ Laden van tabbladen…';
    const data = await getJSON('../api/sheets?action=schema.get', { cache: 'no-store' });
    headersOut.textContent = Object.entries(data)
      .map(([tab, h]) => `📋 ${tab}: ${(h || []).join(', ') || '—'}`)
      .join('\n');
  } catch (e) {
    headersOut.textContent = '❌ ' + e.message;
    headersOut.classList.add('error');
  }
}
btnLoadHeaders?.addEventListener('click', loadHeaders);

/* Ensure alle tabs */
btnEnsureAll?.addEventListener('click', async () => {
  const token = cfgForm.token.value.trim();
  try {
    headersOut.textContent = '⏳ Controle van alle tabs…';
    const body = { entity: 'Schema', action: 'ensureAll', payload: { token } };
    await getJSON('../api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body)
    });
    headersOut.textContent = '✔️ Alle tabbladen gecontroleerd.';
    setTimeout(loadHeaders, 400);
    toast('📐 Schema’s gecontroleerd', 'ok');
  } catch (e) {
    headersOut.textContent = '❌ ' + e.message;
    headersOut.classList.add('error');
    toast('❌ Ensure schema faalde: ' + e.message, 'warn');
  }
});

/* Ensure specifieke tab */
ensureForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const tab = ensureForm.tab.value.trim();
  const cols = ensureForm.columns.value.split(',').map(s => s.trim()).filter(Boolean);
  const token = cfgForm.token.value.trim();
  try {
    setMsg(ensureState, '⏳ Toevoegen…');
    const body = { entity: 'Schema', action: 'ensure', payload: { tab, columns: cols, token } };
    await getJSON('../api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body)
    });
    setMsg(ensureState, '✔️ Kolommen toegevoegd.');
    setTimeout(loadHeaders, 400);
    toast(`➕ Kolommen toegevoegd aan ${tab}`, 'ok');
  } catch (e) {
    setMsg(ensureState, '❌ ' + e.message, true);
    toast('❌ Kolommen toevoegen faalde: ' + e.message, 'warn');
  }
});

/* Rename kolom */
renameForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const tab = renameForm.tab.value.trim();
  const from = renameForm.from.value.trim();
  const to = renameForm.to.value.trim();
  const token = cfgForm.token.value.trim();
  try {
    setMsg(renameState, '⏳ Hernoemen…');
    const body = { entity: 'Schema', action: 'rename', payload: { tab, from, to, token } };
    await getJSON('../api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body)
    });
    setMsg(renameState, `✔️ '${from}' → '${to}' hernoemd.`);
    setTimeout(loadHeaders, 400);
    toast(`✏️ '${from}' → '${to}' in ${tab}`, 'ok');
  } catch (e) {
    setMsg(renameState, '❌ ' + e.message, true);
    toast('❌ Hernoemen faalde: ' + e.message, 'warn');
  }
});

/* Boot: laad admin-data enkel als sectie zichtbaar is */
document.addEventListener('DOMContentLoaded', () => {
  const adminVisible = $('#admin-section') && $('#admin-section').style.display !== 'none';
  if (adminVisible) {
    loadCfg();
    loadHeaders();
  }
});
