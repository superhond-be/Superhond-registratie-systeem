// public/js/klantagenda.js

import {
  initFromConfig,
  fetchSheet
} from './sheets.js';
import { SuperhondUI } from './layout.js';
import { loadEmailTemplates } from './emailTemplates.js';

const $ = (s, r = document) => r.querySelector(s);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])
  );
}

function toArrayRows(x) {
  if (Array.isArray(x)) return x;
  if (x?.data && Array.isArray(x.data)) return x.data;
  if (x?.rows && Array.isArray(x.rows)) return x.rows;
  if (x?.result && Array.isArray(x.result)) return x.result;
  return [];
}

function normalizeLes(row) {
  const o = Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [String(k || '').toLowerCase(), v]));
  return {
    id: (o.id ?? '').toString(),
    lesnaam: (o.naam ?? '').toString(),
    datum: (o.datum ?? '').toString(),
    tijd: (o.tijd ?? '').toString(),
    locatie: (o.locatie ?? '').toString(),
    groep: (o.groep ?? '').toString()
  };
}

function normalizeMed(row) {
  const o = Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [String(k || '').toLowerCase(), v]));
  return {
    id: (o.id ?? '').toString(),
    inhoud: (o.inhoud ?? '').toString(),
    datum: (o.datum ?? '').toString(),
    tijd: (o.tijd ?? '').toString(),
    targetLes: (o.targetles ?? '').toString(),
    doelgroep: (o.doelgroep ?? '').toString(),
    categorie: (o.categorie ?? '').toString(),
    prioriteit: (o.prioriteit ?? '').toString(),
    link: (o.link ?? '').toString(),
    zichtbaar: String(o.zichtbaar ?? '').toLowerCase() !== 'nee'
  };
}

function filterMededelingen(meds, opties) {
  const now = new Date();
  return meds.filter(m => {
    if (!m.zichtbaar) return false;
    if (opties.lesId && m.targetLes && m.targetLes !== opties.lesId) return false;
    if (opties.dag && m.datum && m.datum !== opties.dag) return false;
    if (opties.categorie && m.categorie && m.categorie !== opties.categorie) return false;
    if (opties.prioriteit && m.prioriteit && m.prioriteit !== opties.prioriteit) return false;
    if (m.datum) {
      const dt = new Date(`${m.datum}T${m.tijd || '00:00'}`);
      if (dt < now) return false;
    }
    return true;
  });
}

function renderAgenda(lesData, medData) {
  const el = $('#agenda-list');
  if (!el) {
    console.warn('[Agenda] Element #agenda-list niet gevonden');
    return;
  }
  if (!lesData || !Array.isArray(lesData)) {
    el.innerHTML = `<p class="error">Interne fout: lesData is niet geldig.</p>`;
    return;
  }
  if (lesData.length === 0) {
    el.innerHTML = `<p class="muted">Geen komende lessen.</p>`;
    return;
  }

  const html = lesData.map(l => {
    const meds = filterMededelingen(medData, {
      lesId: l.id,
      dag: l.datum,
      categorie: currentFilters.categorie,
      prioriteit: currentFilters.prioriteit
    });

    return `
      <div class="ag-punt">
        <div class="ag-header">
          <strong>${escapeHtml(l.lesnaam)}</strong> — ${escapeHtml(l.datum)} ${escapeHtml(l.tijd)}
        </div>
        <div class="info">📍 ${escapeHtml(l.locatie || 'Onbekende locatie')}</div>
        ${meds.length ? `
          <div class="mededelingen-onder ${meds.some(m => m.prioriteit === 'Hoog') ? 'urgent' : ''}">
            ${meds.map(m => {
              const tijd = `${m.datum}${m.tijd ? ` ${m.tijd}` : ''}`;
              return `
                <small>${escapeHtml(tijd)} • ${escapeHtml(m.categorie)}</small>
                ${escapeHtml(m.inhoud)}
                ${m.link ? ` <a href="${escapeHtml(m.link)}">[Meer]</a>` : ''}`;
            }).join('<br>')}
          </div>` : ''}
      </div>
    `;
  }).join('');

  el.innerHTML = html;
}

const currentFilters = {
  categorie: '',
  prioriteit: ''
};

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Fallback] DOM loaded');

  SuperhondUI.mount({
    title: 'Agenda & Mededelingen (test modus)',
    icon: '📅',
    back: '../dashboard/'
  });

  // je kunt hier testdata opzetten:
  let lesData = [
    { id: 'T1', lesnaam: 'Puppy Groep', datum: '2025-10-20', tijd: '09:00', locatie: 'Hal 1', groep: 'Puppy' },
    { id: 'T2', lesnaam: 'Gevorderd', datum: '2025-10-21', tijd: '14:00', locatie: 'Hal 2', groep: 'Gevorderd' }
  ];
  let medData = [
    { id: 'M1', inhoud: 'Breng regenjas mee', datum: '2025-10-20', tijd: '08:00', targetLes: 'T1', doelgroep: 'klant', categorie: 'Weer', prioriteit: 'Laag', link: '', zichtbaar: true },
    { id: 'M2', inhoud: 'Let op: les verlaat uur', datum: '2025-10-21', tijd: '13:30', targetLes: 'T2', doelgroep: 'klant', categorie: 'Info', prioriteit: 'Normaal', link: '', zichtbaar: true }
  ];

  // Render meteen met testdata
  renderAgenda(lesData, medData);
});
