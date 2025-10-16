// public/js/klantagenda.local.js

const $ = (s, r=document) => r.querySelector(s);

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );
}

const currentFilters = { categorie:'', prioriteit:'' };

function filterMededelingen(meds, opties) {
  const now = new Date();
  return meds.filter(m => {
    if (m.zichtbaar === false) return false;
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
  const wrap = $('#agenda-list');
  $('#agenda-loader')?.remove();
  if (!lesData?.length) {
    wrap.innerHTML = `<p class="muted">Geen komende lessen.</p>`;
    return;
  }

  const html = lesData.map(l => {
    const meds = filterMededelingen(medData, {
      lesId: l.id, dag: l.datum,
      categorie: currentFilters.categorie,
      prioriteit: currentFilters.prioriteit
    });
    return `
      <div class="ag-punt">
        <div class="ag-header"><strong>${escapeHtml(l.lesnaam)}</strong> — ${escapeHtml(l.datum)} ${escapeHtml(l.tijd)}</div>
        <div class="info">📍 ${escapeHtml(l.locatie || 'Onbekende locatie')}</div>
        ${meds.length ? `
          <div class="mededelingen-onder ${meds.some(m => m.prioriteit === 'Hoog') ? 'urgent' : ''}">
            ${meds.map(m => {
              const t = `${m.datum}${m.tijd ? ` ${m.tijd}` : ''}`;
              return `<small>${escapeHtml(t)} • ${escapeHtml(m.categorie||'')}</small>${escapeHtml(m.inhoud)}${m.link ? ` <a href="${escapeHtml(m.link)}">[Meer]</a>` : ''}`;
            }).join('<br>')}
          </div>` : ''}
      </div>`;
  }).join('');
  wrap.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
  // ✳️ Lokale testdata
  const lesData = [
    { id:'T1', lesnaam:'Puppy Groep', datum:'2025-10-20', tijd:'09:00', locatie:'Hal 1', groep:'Puppy' },
    { id:'T2', lesnaam:'Gevorderd',  datum:'2025-10-21', tijd:'14:00', locatie:'Hal 2', groep:'Gevorderd' }
  ];
  const medData = [
    { id:'M1', inhoud:'Breng regenjas mee', datum:'2025-10-20', tijd:'08:00', targetLes:'T1', categorie:'Weer', prioriteit:'Laag',   zichtbaar:true },
    { id:'M2', inhoud:'Les verlaat uur',    datum:'2025-10-21', tijd:'13:30', targetLes:'T2', categorie:'Info', prioriteit:'Normaal', zichtbaar:true },
    { id:'M3', inhoud:'Trainer ziek → afgelast', datum:'2025-10-21', tijd:'11:00', targetLes:'T2', categorie:'Info', prioriteit:'Hoog', zichtbaar:true }
  ];

  // sorteer lessen
  lesData.sort((a,b)=>(`${a.datum} ${a.tijd||''}`).localeCompare(`${b.datum} ${b.tijd||''}`));

  // filter events
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
