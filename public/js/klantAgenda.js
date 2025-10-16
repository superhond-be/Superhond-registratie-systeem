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
    id: String(o.id ?? ''),
    lesnaam: String(o.naam ?? ''),
    datum: String(o.datum ?? ''),
    tijd: String(o.tijd ?? ''),
    locatie: String(o.locatie ?? ''),
    groep: String(o.groep ?? '')
  };
}

function normalizeMed(row) {
  const o = Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [String(k || '').toLowerCase(), v]));
  return {
    id: String(o.id ?? ''),
    inhoud: String(o.inhoud ?? ''),
    datum: String(o.datum ?? ''),
    tijd: String(o.tijd ?? ''),
    targetLes: String(o.targetles ?? ''),
    doelgroep: String(o.doelgroep ?? ''),
    categorie: String(o.categorie ?? ''),
    prioriteit: String(o.prioriteit ?? ''),
    link: String(o.link ?? ''),
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
    el.innerHTML = `<p class="error">Fout: lesData is niet correct geladen.</p>`;
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

const currentFilters = { categorie: '', prioriteit: '' };

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Start] DOMContentLoaded');

  try {
    SuperhondUI.mount({
      title: 'Agenda & Mededelingen',
      icon: '📅',
      back: '../dashboard/'
    });
    console.log('[Init] SuperhondUI mounted');
  } catch (e) {
    console.error('[Init] Error mounting UI:', e);
  }

  try {
    await initFromConfig();
    console.log('[Init] Config geladen');
  } catch (e) {
    console.error('[Init] initFromConfig mislukt:', e);
    // We kunnen doorgaan, maar fetchSheet zal falen
  }

  let lesData = [], medData = [];

  try {
    const useLocalTemplates = true;
    const templates = await loadEmailTemplates(useLocalTemplates);
    console.log('[Load] EmailTemplates geladen:', templates);
  } catch (e) {
    console.error('[Load] loadEmailTemplates mislukt:', e);
  }

  try {
    const rawL = await fetchSheet('Lessen');
    console.log('[Load] Ruwe Lessen:', rawL);
    lesData = toArrayRows(rawL).map(normalizeLes);
    console.log('[Norm] lesData:', lesData);
  } catch (e) {
    console.error('[Load] fetchSheet Lessen mislukt:', e);
  }

  try {
    const rawM = await fetchSheet('Mededelingen');
    console.log('[Load] Ruwe Mededelingen:', rawM);
    medData = toArrayRows(rawM).map(normalizeMed);
    console.log('[Norm] medData:', medData);
  } catch (e) {
    console.error('[Load] fetchSheet Mededelingen mislukt:', e);
  }

  // Sorteer lessen
  try {
    lesData.sort((a, b) => {
      const da = `${a.datum} ${a.tijd}`;
      const db = `${b.datum} ${b.tijd}`;
      return da.localeCompare(db);
    });
  } catch (e) {
    console.error('[Sort] sorteren mislukt:', e);
  }

  // Renderen
  try {
    renderAgenda(lesData, medData);
    console.log('[Render] agenda getoond');
  } catch (e) {
    console.error('[Render] renderAgenda mislukt:', e);
  }
});
