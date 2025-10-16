// public/js/klantagenda.js

import {
  initFromConfig,
  fetchSheet
} from './sheets.js';
import { SuperhondUI } from './layout.js';
import { loadEmailTemplates } from './emailTemplates.js';

const $ = (s, r = document) => r.querySelector(s);

const escapeHtml = s =>
  String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

const toArrayRows = x =>
  Array.isArray(x) ? x :
  Array.isArray(x?.data) ? x.data :
  Array.isArray(x?.rows) ? x.rows :
  Array.isArray(x?.result) ? x.result : [];

const normalizeLes = row => {
  const o = Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    id:       String(o.id ?? ''),
    lesnaam:  String(o.naam ?? ''),
    datum:    String(o.datum ?? ''),
    tijd:     String(o.tijd ?? ''),
    locatie:  String(o.locatie ?? ''),
    groep:    String(o.groep ?? '')
  };
};

const normalizeMed = row => {
  const o = Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    id:         String(o.id ?? ''),
    inhoud:     String(o.inhoud ?? ''),
    datum:      String(o.datum ?? ''),
    tijd:       String(o.tijd ?? ''),
    targetLes:  String(o.targetles ?? ''),
    doelgroep:  String(o.doelgroep ?? ''),
    categorie:  String(o.categorie ?? ''),
    prioriteit: String(o.prioriteit ?? ''),
    link:       String(o.link ?? ''),
    zichtbaar:  String(o.zichtbaar ?? '').toLowerCase() !== 'nee'
  };
};

const filterMededelingen = (meds, opties) => {
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
};

const renderAgenda = (lesData, medData) => {
  const el = $('#agenda-list');
  if (!el) return;

  if (!lesData.length) {
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
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  el.innerHTML = html;
};

const currentFilters = {
  categorie: '',
  prioriteit: ''
};

document.addEventListener('DOMContentLoaded', async () => {
  SuperhondUI.mount({
    title: 'Agenda & Mededelingen',
    icon: '📅',
    back: '../dashboard/'
  });

  await initFromConfig();

  // Voor testen: lokaal of via Google Sheets
  const useLocalTemplates = true;
  const templates = await loadEmailTemplates(useLocalTemplates);
  console.log('Loaded email templates:', templates);

  $('#filter-categorie')?.addEventListener('change', e => {
    currentFilters.categorie = e.target.value;
    renderAgenda(lesData, medData);
  });

  $('#filter-prioriteit')?.addEventListener('change', e => {
    currentFilters.prioriteit = e.target.value;
    renderAgenda(lesData, medData);
  });

  let lesData = [], medData = [];

  try {
    const rawL = await fetchSheet('Lessen');
    lesData = toArrayRows(rawL).map(normalizeLes);
  } catch (e) {
    console.error('Fout bij laden lessen:', e);
  }

  try {
    const rawM = await fetchSheet('Mededelingen');
    medData = toArrayRows(rawM).map(normalizeMed);
  } catch (e) {
    console.warn('Fout bij laden mededelingen:', e);
  }

  lesData.sort((a, b) => `${a.datum} ${a.tijd}`.localeCompare(`${b.datum} ${b.tijd}`));
  renderAgenda(lesData, medData);
});
