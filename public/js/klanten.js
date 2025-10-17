/**
 * klanten.js — v0.27.7
 * Verbeterde versie met langere timeout, duidelijkere statusmeldingen
 * en robuuste afhandeling van trage verbindingen.
 */

import { fetchSheet, initFromConfig } from './sheets.js';

const TIMEOUT_MS = 15000; // 15s i.p.v. 8s
let aborter = null;

// DOM helpers
const $ = (s, r = document) => r.querySelector(s);
const tblBody = $('#tbl tbody');
const stateBox = $('#state');

function setState(msg, cls = '') {
  stateBox.textContent = msg;
  stateBox.className = 'muted ' + cls;
}

function renderTable(rows = []) {
  tblBody.innerHTML = '';
  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" class="muted">Geen klanten gevonden.</td>`;
    tblBody.appendChild(tr);
    return;
  }

  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.naam || ''}</td>
      <td>${row.email || ''}</td>
      <td>${row.telefoon || ''}</td>
      <td>${row.status || ''}</td>
      <td><button class="btn small">✏️</button></td>
    `;
    tblBody.appendChild(tr);
  }
}

export async function initKlantenTab() {
  console.log('[klanten] init gestart');

  await initFromConfig(); // ✅ eerst Exec-URL ophalen

  $('#refresh').addEventListener('click', refresh);
  $('#search').addEventListener('input', filter);

  refresh(); // eerste load
}

async function refresh() {
  console.log('[klanten] refresh start');
  if (aborter) aborter.abort();
  aborter = new AbortController();

  setState('⏳ Laden…');

  const timer = setTimeout(() => {
    aborter.abort();
    console.warn('[klanten] Timeout na', TIMEOUT_MS, 'ms');
  }, TIMEOUT_MS);

  try {
    const raw = await fetchSheet('Klanten', { signal: aborter.signal });
    clearTimeout(timer);

    console.log('[klanten] Data ontvangen:', raw);
    const rows = Array.isArray(raw.data) ? normalize(raw.data) : [];
    renderTable(rows);

    setState(`✅ ${rows.length} klanten geladen`, 'ok');
  } catch (err) {
    clearTimeout(timer);
    console.error('[klanten] Laden mislukt:', err);

    if (err.name === 'AbortError') {
      setState('⚠️ Verbinding traag, probeer opnieuw', 'warn');
    } else {
      setState('❌ Fout bij laden', 'error');
    }
  }
}

function normalize(rows) {
  // verwacht eerste rij = headers
  const [header, ...body] = rows;
  const map = header.map(h => h.toLowerCase());
  return body.map(r => {
    const o = {};
    map.forEach((k, i) => (o[k] = r[i]));
    return o;
  });
}

function filter() {
  const q = $('#search').value.trim().toLowerCase();
  const allRows = Array.from(tblBody.rows);
  allRows.forEach(tr => {
    const match = tr.textContent.toLowerCase().includes(q);
    tr.style.display = match ? '' : 'none';
  });
}
