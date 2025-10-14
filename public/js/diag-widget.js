// public/js/diag-widget.js — diagnose in Instellingen
// Werkt met jouw sheets.js (initFromConfig, setBaseUrl, getBaseUrl, fetchSheet)

import { initFromConfig, setBaseUrl, getBaseUrl, fetchSheet } from './sheets.js';

const $ = (s, r = document) => r.querySelector(s);

function resolveExecFromPage() {
  if (typeof window.SUPERHOND_SHEETS_URL === 'string' && window.SUPERHOND_SHEETS_URL) {
    return window.SUPERHOND_SHEETS_URL;
  }
  const meta = document.querySelector('meta[name="superhond-exec"]');
  return meta?.content?.trim() || '';
}

async function pingDirect(base) {
  if (!base) return { ok: false, msg: 'Geen base-URL' };
  const url = base + (base.includes('?') ? '&' : '?') + 'mode=ping&t=' + Date.now();
  try {
    const r = await fetch(url, { cache: 'no-store' });
    const txt = await r.text();
    return { ok: r.ok, msg: `HTTP ${r.status} — ${txt.slice(0, 120)}` };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
}

function addRow(tbody, step, ok, note = '') {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${step}</td>
    <td class="${ok ? 'ok' : 'err'}" style="font-weight:700;${ok ? 'color:#16a34a' : 'color:#b91c1c'}">
      ${ok ? 'OK' : 'ERR'}
    </td>
    <td><code style="font-size:.86em;word-break:break-all">${String(note || '').slice(0, 1000)}</code></td>
  `;
  tbody.appendChild(tr);
}

async function runDiag() {
  const execInput = $('#diag-exec');
  const tbody = $('#diag-table tbody');
  tbody.innerHTML = '';

  // 1) init → probeert /api/config, localStorage en window.SUPERHOND_SHEETS_URL
  try { await initFromConfig(); } catch {}

  let base = getBaseUrl() || resolveExecFromPage();
  addRow(tbody, 'Basis-URL', !!base, base || '—');

  // 2) Ping
  if (base) {
    const p = await pingDirect(base);
    addRow(tbody, 'GAS ping', p.ok, p.msg);
  } else {
    addRow(tbody, 'GAS ping', false, 'Geen base-URL ingesteld');
  }

  // 3) Klanten
  try {
    const k = await fetchSheet('Klanten');
    addRow(tbody, 'Sheet:Klanten', true, `Rijen: ${k?.length ?? 0}`);
  } catch (e) {
    addRow(tbody, 'Sheet:Klanten', false, e?.message || String(e));
  }

  // 4) Honden
  try {
    const h = await fetchSheet('Honden');
    addRow(tbody, 'Sheet:Honden', true, `Rijen: ${h?.length ?? 0}`);
  } catch (e) {
    addRow(tbody, 'Sheet:Honden', false, e?.message || String(e));
  }

  // Input updaten met huidige base
  execInput.value = base || '';
}

function wireUi() {
  const execInput = $('#diag-exec');
  $('#diag-use')?.addEventListener('click', () => {
    const v = execInput.value.trim();
    if (!v) { alert('Vul een geldige /exec-URL in.'); return; }
    setBaseUrl(v);   // sheets.js slaat dit ook op in localStorage
    runDiag();
  });

  $('#diag-run')?.addEventListener('click', runDiag);

  $('#diag-clear')?.addEventListener('click', () => {
    try { localStorage.removeItem('superhond:apiBase'); } catch {}
    alert('Cache gewist. Herlaad de pagina (Cmd/Ctrl + Shift + R) voor een schone start.');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  wireUi();
  runDiag();
});
