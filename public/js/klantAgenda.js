/**
 * public/js/klantAgenda.js
 * Toont klantagenda + gekoppelde mededelingen, met blauwe balk
 */

import {
  initFromConfig,
  fetchSheet
} from './sheets.js';
import { SuperhondUI } from './layout.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])
  );
}

function toArrayRows(x) {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x && Array.isArray(x.rows)) return x.rows;
  if (x && Array.isArray(x.result)) return x.result;
  return [];
}

function normalizeLes(row) {
  const o = {};
  for (const [k, v] of Object.entries(row || {})) {
    o[String(k || '').toLowerCase()] = v;
  }
  return {
    id:       (o.id ?? '').toString(),
    lesnaam:  (o.naam ?? '').toString(),
    datum:    (o.datum ?? '').toString(),
    tijd:     (o.tijd ?? '').toString(),
    locatie:  (o.locatie ?? '').toString(),
    groep:    (o.groep ?? '').toString()
  };
}

function normalizeMed(row) {
  const o = {};
  for (const [k, v] of Object.entries(row || {})) {
    o[String(k || '').toLowerCase()] = v;
  }
  return {
    id:        (o.id ?? '').toString(),
    inhoud:    (o.inhoud ?? '').toString(),
    datum:     (o.datum ?? '').toString(),
    tijd:      (o.tijd ?? '').toString(),
    targetLes: (o.targetles ?? '').toString(),
    doelgroep: (o.doelgroep ?? '').toString(),
    zichtbaar: (String(o.zichtbaar ?? '').toLowerCase() !== 'nee')
  };
}

function filterMededelingen(meds, opties) {
  const now = new Date();
  return meds.filter(m => {
    if (!m.zichtbaar) return false;
    if (opties.lesId && m.targetLes && m.targetLes !== opties.lesId) return false;
    if (opties.dag && m.datum && m.datum !== opties.dag) return false;
    if (m.datum) {
      const dt = new Date(m.datum + (m.tijd ? `T${m.tijd}` : `T00:00`));
      if (dt < now) return false;
    }
    return true;
  });
}

function renderAgenda(agendas, mededelingen) {
  const el = $('#agenda-list');
  if (!el) return;
  if (!agendas.length) {
    el.innerHTML = `<p class="muted">Geen komende lessen.</p>`;
    return;
  }
  const html = agendas.map(l => {
    const medsFor = filterMededelingen(mededelingen, {
      lesId: l.id,
      dag: l.datum
    });
    return `
      <div class="ag-punt">
        <div><strong>${escapeHtml(l.lesnaam)}</strong> — ${escapeHtml(l.datum)} ${escapeHtml(l.tijd)}</div>
        <div class="info">📍 ${escapeHtml(l.locatie || 'Onbekend locatie')}</div>
        ${medsFor.length ? `
          <div class="mededelingen-onder">
            ${medsFor.map(m => {
              const tijd = m.datum + (m.tijd ? ` ${m.tijd}` : '');
              return `<small>${escapeHtml(tijd)}</small>${escapeHtml(m.inhoud)}`;
            }).join('<br>')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  el.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', async () => {
  // Topbar + mount
  SuperhondUI.mount({
    title: 'Agenda & Mededelingen',
    icon: '📅',
    back: '../dashboard/',
    home: false
  });

  await initFromConfig();

  const params = new URLSearchParams(location.search);
  const klantId = params.get('klantId') || '';

  let lesData = [];
  let medData = [];

  try {
    const rawL = await fetchSheet('Lessen');
    lesData = toArrayRows(rawL).map(normalizeLes);
    // Optioneel filteren op klantId
  } catch (e) {
    console.error('Fout bij laden lessen:', e);
  }

  try {
    const rawM = await fetchSheet('Mededelingen');
    medData = toArrayRows(rawM).map(normalizeMed);
  } catch (e) {
    console.warn('Fout bij laden mededelingen:', e);
  }

  lesData.sort((a, b) => {
    const da = a.datum + ' ' + (a.tijd || '');
    const db = b.datum + ' ' + (b.tijd || '');
    return da.localeCompare(db);
  });

  renderAgenda(lesData, medData);
});
