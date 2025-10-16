import {
  initFromConfig,
  fetchSheet
} from './sheets.js';
import { SuperhondUI } from './layout.js';

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])
  );
}

function toArrayRows(x) {
  if (Array.isArray(x)) return x;
  if (x && x.data && Array.isArray(x.data)) return x.data;
  if (x && x.rows && Array.isArray(x.rows)) return x.rows;
  if (x && x.result && Array.isArray(x.result)) return x.result;
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
    categorie: (o.categorie ?? '').toString(),
    prioriteit: (o.prioriteit ?? '').toString(),
    link:      (o.link ?? '').toString(),
    zichtbaar: (String(o.zichtbaar ?? '').toLowerCase() !== 'nee')
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
      const dt = new Date(m.datum + (m.tijd ? `T${m.tijd}` : `T00:00`));
      if (dt < now) return false;
    }
    return true;
  });
}

function renderAgenda(lesData, medData) {
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
        <div class="info">📍 ${escapeHtml(l.locatie || 'Onbekend locatie')}</div>
        ${meds.length ? `
          <div class="mededelingen-onder ${meds.some(m=>m.prioriteit==='Hoog') ? 'urgent' : ''}">
            ${meds.map(m => {
              const tijd = m.datum + (m.tijd ? ` ${m.tijd}` : '');
              return `<small>${escapeHtml(tijd)} • ${escapeHtml(m.categorie)}</small>${escapeHtml(m.inhoud)}${m.link ? ` <a href="${escapeHtml(m.link)}">[Meer]</a>` : ''}`;
            }).join('<br>')}
          </div>
        ` : ''}
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
  SuperhondUI.mount({
    title: 'Agenda & Mededelingen',
    icon: '📅',
    back: '../dashboard/'
  });

  await initFromConfig();

  $('#filter-categorie')?.addEventListener('change', e => {
    currentFilters.categorie = e.target.value;
    renderAgenda(lesData, medData);
  });
  $('#filter-prioriteit')?.addEventListener('change', e => {
    currentFilters.prioriteit = e.target.value;
    renderAgenda(lesData, medData);
  });

  let lesData = [];
  let medData = [];

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

  lesData.sort((a,b) => {
    const da = a.datum + ' ' + (a.tijd || '');
    const db = b.datum + ' ' + (b.tijd || '');
    return da.localeCompare(db);
  });

  renderAgenda(lesData, medData);
});
