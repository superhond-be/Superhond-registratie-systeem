// public/js/klantagenda.js
// LOKALE TESTVERSIE — toont agenda + mededelingen met filters (zonder Google Sheets)

import { SuperhondUI } from './layout.js';

const $ = (sel, root = document) => root.querySelector(sel);

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])
  );
}

/* ---------- filterlogica ---------- */
function filterMededelingen(meds, opties) {
  const now = new Date();
  return (meds || []).filter(m => {
    if (!m?.zichtbaar) return false;
    if (opties.lesId && m.targetLes && m.targetLes !== opties.lesId) return false;
    if (opties.dag && m.datum && m.datum !== opties.dag) return false;
    if (opties.categorie && m.categorie && m.categorie !== opties.categorie) return false;
    if (opties.prioriteit && m.prioriteit && m.prioriteit !== opties.prioriteit) return false;
    if (m.datum) {
      const dt = new Date(`${m.datum}T${m.tijd || '00:00'}`);
      if (isFinite(dt) && dt < now) return false;
    }
    return true;
  });
}

/* ---------- render ---------- */
function renderAgenda(lesData, medData, currentFilters) {
  const wrap = $('#agenda-list');
  const loader = $('#agenda-loader');
  if (!wrap) return;

  if (loader) loader.remove();

  if (!Array.isArray(lesData) || lesData.length === 0) {
    wrap.innerHTML = `<p class="muted">Geen komende lessen.</p>`;
    return;
  }

  const html = lesData.map(l => {
    const meds = filterMededelingen(medData, {
      lesId: l.id,
      dag: l.datum,
      categorie: currentFilters.categorie,
      prioriteit: currentFilters.prioriteit
    });

    const medsHtml = meds.length
      ? `
        <div class="mededelingen-onder ${meds.some(m => m.prioriteit === 'Hoog') ? 'urgent' : ''}">
          ${meds.map(m => {
            const tijd = `${m.datum}${m.tijd ? ` ${m.tijd}` : ''}`;
            return `
              <small>${escapeHtml(tijd)}${m.categorie ? ` • ${escapeHtml(m.categorie)}` : ''}</small>
              ${escapeHtml(m.inhoud)}${m.link ? ` <a href="${escapeHtml(m.link)}">[Meer]</a>` : ''}`;
          }).join('<br>')}
        </div>`
      : '';

    return `
      <div class="ag-punt">
        <div class="ag-header">
          <strong>${escapeHtml(l.lesnaam)}</strong> — ${escapeHtml(l.datum)} ${escapeHtml(l.tijd)}
        </div>
        <div class="info">📍 ${escapeHtml(l.locatie || 'Onbekende locatie')}</div>
        ${medsHtml}
      </div>`;
  }).join('');

  wrap.innerHTML = html;
}

/* ---------- hulpfuncties ---------- */
function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'nl'));
}

function populateFilters(medData) {
  const selCat = $('#filter-categorie');
  const selPri = $('#filter-prioriteit');
  if (!selCat && !selPri) return;

  const cats = uniqueSorted((medData || []).map(m => m.categorie));
  const pris = uniqueSorted((medData || []).map(m => m.prioriteit));

  if (selCat) {
    const cur = selCat.value;
    selCat.innerHTML = `<option value="">Alle categorieën</option>` +
      cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    // behoud huidige selectie indien van toepassing
    if ([...selCat.options].some(o => o.value === cur)) selCat.value = cur;
  }

  if (selPri) {
    const cur = selPri.value;
    selPri.innerHTML = `<option value="">Alle prioriteiten</option>` +
      pris.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
    if ([...selPri.options].some(o => o.value === cur)) selPri.value = cur;
  }
}

/* ---------- LOKALE TESTDATA ---------- */
const lesDataLocal = [
  { id: 'T1', lesnaam: 'Puppy Groep', datum: '2025-10-20', tijd: '09:00', locatie: 'Hal 1', groep: 'Puppy' },
  { id: 'T2', lesnaam: 'Gevorderd',   datum: '2025-10-21', tijd: '14:00', locatie: 'Hal 2', groep: 'Gevorderd' }
];

const medDataLocal = [
  { id: 'M1', inhoud: 'Breng regenjas mee',      datum: '2025-10-20', tijd: '08:00', targetLes: 'T1', doelgroep: 'klant', categorie: 'Weer', prioriteit: 'Laag',    link: '', zichtbaar: true },
  { id: 'M2', inhoud: 'Let op: les verlaat uur', datum: '2025-10-21', tijd: '13:30', targetLes: 'T2', doelgroep: 'klant', categorie: 'Info', prioriteit: 'Normaal', link: '', zichtbaar: true },
  { id: 'M3', inhoud: 'Trainer ziek, mogelijk wijziging', datum: '2025-10-21', tijd: '08:00', targetLes: 'T2', doelgroep: 'klant', categorie: 'Belangrijk', prioriteit: 'Hoog', link: '', zichtbaar: true }
];

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // Topbar/blauwe balk
  try {
    SuperhondUI?.mount?.({
      title: 'Agenda & Mededelingen',
      icon: '📅',
      back: '../dashboard/'
    });
  } catch (e) {
    console.warn('[klantagenda] mount warning:', e);
  }

  // filters opbouwen
  populateFilters(medDataLocal);

  // filter state
  const currentFilters = { categorie: '', prioriteit: '' };

  // listeners
  $('#filter-categorie')?.addEventListener('change', e => {
    currentFilters.categorie = e.target.value;
    renderAgenda(lesDataLocal, medDataLocal, currentFilters);
  });
  $('#filter-prioriteit')?.addEventListener('change', e => {
    currentFilters.prioriteit = e.target.value;
    renderAgenda(lesDataLocal, medDataLocal, currentFilters);
  });

  // sorteer lessen op datum+tijd
  const lesData = [...lesDataLocal].sort((a, b) => {
    const da = `${a.datum} ${a.tijd || ''}`;
    const db = `${b.datum} ${b.tijd || ''}`;
    return da.localeCompare(db);
  });

  // eerste render
  renderAgenda(lesData, medDataLocal, currentFilters);
});
