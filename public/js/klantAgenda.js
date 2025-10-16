import { SuperhondUI } from './layout.js';

const $ = (s, r = document) => r.querySelector(s);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
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
  SuperhondUI.mount({
    title: 'Agenda & Mededelingen (Testmodus)',
    icon: '📅',
    back: '../dashboard/'
  });

  // LOKALE TESTDATA
  const lesData = [
    { id: 'T1', lesnaam: 'Puppy Groep', datum: '2025-10-20', tijd: '09:00', locatie: 'Hal 1', groep: 'Puppy' },
    { id: 'T2', lesnaam: 'Gevorderd', datum: '2025-10-21', tijd: '14:00', locatie: 'Hal 2', groep: 'Gevorderd' }
  ];

  const medData = [
    { id: 'M1', inhoud: 'Breng regenjas mee', datum: '2025-10-20', tijd: '08:00', targetLes: 'T1', doelgroep: 'klant', categorie: 'Weer', prioriteit: 'Laag', link: '', zichtbaar: true },
    { id: 'M2', inhoud: 'Let op: les verlaat uur', datum: '2025-10-21', tijd: '13:30', targetLes: 'T2', doelgroep: 'klant', categorie: 'Info', prioriteit: 'Normaal', link: '', zichtbaar: true }
  ];

  // E-mailtemplates (kan later verder geïntegreerd worden)
  const emailTemplates = [
    {
      templateId: 'concept_herinnering',
      naam: 'Herinnering: boeking in concept',
      trigger: 'status_concept',
      onderwerp: '{{voornaam}}, je boeking wacht op bevestiging',
      body: 'Beste {{voornaam}}, je boeking voor {{lesNaam}} op {{lesDatum}} staat nog in concept. Gelieve te bevestigen.',
      zichtbaar: 'ja',
      automatisch: 'nee',
      categorie: 'Boekingen',
      doelgroep: 'klant'
    },
    {
      templateId: 'bevestiging_boeking',
      naam: 'Bevestiging boeking',
      trigger: 'status_bevestigd',
      onderwerp: 'Je boeking is bevestigd, {{voornaam}}!',
      body: 'Hallo {{voornaam}}, je boeking voor {{lesNaam}} op {{lesDatum}} is goedgekeurd. Tot dan!',
      zichtbaar: 'ja',
      automatisch: 'ja',
      categorie: 'Boekingen',
      doelgroep: 'klant'
    }
  ];

  console.log('[Testdata geladen]', { lesData, medData, emailTemplates });

  // Eventlisteners op dropdowns (optioneel)
  $('#filter-categorie')?.addEventListener('change', e => {
    currentFilters.categorie = e.target.value;
    renderAgenda(lesData, medData);
  });

  $('#filter-prioriteit')?.addEventListener('change', e => {
    currentFilters.prioriteit = e.target.value;
    renderAgenda(lesData, medData);
  });

  renderAgenda(lesData, medData);
});
