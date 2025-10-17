/**
 * honden-tab.js — v0.27.7
 * Stabiele versie: langere timeout, duidelijke statusmeldingen,
 * en consistente code met klanten.js.
 */

import { fetchSheet, initFromConfig } from './sheets.js';

const TIMEOUT_MS = 15000; // 15s i.p.v. 8s
let aborter = null;

// DOM helpers
const $ = (s, r = document) => r.querySelector(s);
const tblBody = $('#tbl-hond tbody');
const stateBox = $('#state-hond');

function setState(msg, cls = '') {
  stateBox.textContent = msg;
  stateBox.className = 'muted ' + cls;
}

function renderTable(rows = []) {
  tblBody.innerHTML = '';
  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" class="muted">Geen honden gevonden.</td>`;
    tblBody.appendChild(tr);
    return;
  }

  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.naam || ''}</td>
      <td>${row.ras || ''}</td>
      <td>${row.geboortedatum || ''}</td>
      <td>${row.eigenaar || row.eigenaar_id || ''}</td>
      <td><button class="btn small">✏️</button></td>
    `;
    tblBody.appendChild(tr);
  }
}

export async function initHondenTab() {
  console.log('[honden] init gestart');

  await initFromConfig(); // ✅ eerst Exec-URL ophalen

  $('#refresh-hond')?.addEventListener('click', refresh);
  $('#search-hond')?.addEventListener('input', filter);

  refresh(); // eerste load
}

async function refresh() {
  console.log('[honden] refresh start');
  if (aborter) aborter.abort();
  aborter = new AbortController();

  setState('⏳ Laden…');

  const timer = setTimeout(() => {
    aborter.abort();
    console.warn('[honden] Timeout na', TIMEOUT_MS, 'ms');
  }, TIMEOUT_MS);

  try {
    const raw = await fetchSheet('Honden', { signal: aborter.signal });
    clearTimeout(timer);

    console.log('[honden] Data ontvangen:', raw);
    const rows = Array.isArray(raw.data) ? normalize(raw.data) : [];
    renderTable(rows);

    setState(`✅ ${rows.length} honden geladen`, 'ok');
  } catch (err) {
    clearTimeout(timer);
    console.error('[honden] Laden mislukt:', err);

    if (err.name === 'AbortError') {
      setState('⚠️ Verbinding traag, probeer opnieuw', 'warn');
    } else {
      setState('❌ Fout bij laden', 'error');
    }
  }
}

function normalize(rows) {
  const [header, ...body] = rows;
  const map = header.map(h => h.toLowerCase());
  return body.map(r => {
    const o = {};
    map.forEach((k, i) => (o[k] = r[i]));
    return o;
  });
}

function filter() {
  const q = $('#search-hond').value.trim().toLowerCase();
  const allRows = Array.from(tblBody.rows);
  allRows.forEach(tr => {
    const match = tr.textContent.toLowerCase().includes(q);
    tr.style.display = match ? '' : 'none';
  });
}
