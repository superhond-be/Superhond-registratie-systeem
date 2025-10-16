/**
 * public/js/agenda.js — Dashboard badges + agenda (v0.27.5)
 * - Telt actieve Klassen/Reeksen
 * - (optioneel) toont 'Agenda'-tabel uit Google Sheet
 */

import {
  initFromConfig,
  fetchSheet,
  getBaseUrl,
} from './sheets.js';

const $ = (s, r = document) => r.querySelector(s);
const TIMEOUT_MS = 20000;

const toArrayRows = (x) =>
  Array.isArray(x) ? x :
  Array.isArray(x?.data) ? x.data :
  Array.isArray(x?.rows) ? x.rows :
  Array.isArray(x?.result) ? x.result :
  Array.isArray(x?.data?.rows) ? x.data.rows :
  x?.ok === true && Array.isArray(x?.data) ? x.data : [];

const norm = (s) => String(s ?? '').trim().toLowerCase();

async function updateBadges() {
  try {
    const [klassenRaw, reeksenRaw] = await Promise.all([
      fetchSheet('Klassen', { timeout: TIMEOUT_MS }),
      fetchSheet('Reeksen', { timeout: TIMEOUT_MS }).catch(() => [])
    ]);

    const klassen = toArrayRows(klassenRaw);
    const reeksen = toArrayRows(reeksenRaw);

    const actKl = klassen.filter(k => norm(k.status) === 'actief').length;
    const actRs = reeksen.filter(r => norm(r.status) === 'actief').length;

    const kb = $('#klassen-badge'); if (kb) kb.textContent = actKl;
    const ks = $('#klassen-sub');   if (ks) ks.textContent = actKl ? `${actKl} actief` : '—';

    const rb = $('#reeksen-badge'); if (rb) rb.textContent = actRs;
    const rs = $('#reeksen-sub');   if (rs) rs.textContent = actRs ? `${actRs} actief` : '—';
  } catch (e) {
    console.warn('[agenda] update badges faalde:', e?.message || e);
  }
}

async function fillAgenda() {
  const wrap   = $('#agenda-table-wrap');
  const body   = $('#agenda-table tbody');
  const loader = $('#agenda-loader');
  const err    = $('#agenda-error');
  if (!wrap || !body) return;

  loader?.style?.setProperty('display', '');
  err?.style?.setProperty('display', 'none');
  wrap.style.display = 'none';

  try {
    const raw = await fetchSheet('Agenda', { timeout: TIMEOUT_MS });
    const rows = toArrayRows(raw);

    body.innerHTML = '';
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="4" class="muted">Geen items.</td></tr>`;
    } else {
      for (const r of rows) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r.naam || r.title || ''}</td>
          <td>${r.datum || r.date || ''}</td>
          <td>${r.locatie || r.location || ''}</td>
          <td>${r.trainers || r.trainer || ''}</td>`;
        body.appendChild(tr);
      }
    }
    wrap.style.display = '';
  } catch (e) {
    console.error('[agenda] laden faalde:', e);
    if (err) {
      err.textContent = '❌ Laden faalde: ' + (e?.message || e);
      err.style.display = '';
    }
  } finally {
    loader?.style?.setProperty('display', 'none');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await initFromConfig();
  try {
    console.info('[Agenda] exec base =', getBaseUrl?.() || '(onbekend)');
  } catch {}

  updateBadges();
  fillAgenda(); // uitschakelbaar als je geen 'Agenda' tab hebt
});
