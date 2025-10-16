/**
 * public/js/dashboard.js — Dashboard-logica (v0.27.5)
 */

import { initFromConfig } from './sheets.js';
import { loadDB, saveDB, downloadJSON } from './store.js';
import {
  computeEndISO, toMapsUrl,
  createLesson, addLesson, updateLesson, deleteLesson, listLessons,
  createNotice, addNotice, listNotices,
  generateSeries, buildAgenda
} from './models.js';
import { SuperhondUI } from './layout.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Zorg dat exec-URL geladen is
  await initFromConfig();

  // Mount topbar/footer
  SuperhondUI.mount({ title: 'Superhond', icon: '🐾', home: true });

  // Tabs logica
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tabpanel');
  tabs.forEach(b => b.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    panels.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    document.getElementById(b.dataset.tab)?.classList.add('active');
  }));

  const subtabs = document.querySelectorAll('.subtab');
  subtabs.forEach(s => s.addEventListener('click', () => {
    subtabs.forEach(x => x.classList.remove('active'));
    s.classList.add('active');
    renderAgenda();
  }));

  const agendaList = document.getElementById('agendaList');
  const agendaStart = document.getElementById('agendaStart');
  const btnToday   = document.getElementById('btnToday');

  btnToday?.addEventListener('click', () => {
    const today = new Date().toISOString().slice(0, 10);
    if (agendaStart) {
      agendaStart.value = today;
      renderAgenda();
    }
  });

  if (agendaStart) agendaStart.value = new Date().toISOString().slice(0,10);

  // Exports / downloads
  document.getElementById('btnExportLessen')?.addEventListener('click', () => {
    downloadJSON('lessen.json', { lessons: listLessons() });
  });
  document.getElementById('btnExportAgenda')?.addEventListener('click', () => {
    downloadJSON('agenda.json', { items: buildAgenda() });
  });

  // Beheer les formulier
  const formLes = document.getElementById('formLes');
  const els = {
    id:       document.getElementById('lesId'),
    titel:    document.getElementById('lesTitel'),
    start:    document.getElementById('lesStart'),
    duur:     document.getElementById('lesDuur'),
    einde:    document.getElementById('lesEinde'),
    trainers: document.getElementById('lesTrainers'),
    locNaam:  document.getElementById('locNaam'),
    locMaps:  document.getElementById('locMaps'),
    btnDelete: document.getElementById('btnDeleteLes'),
    btnReset:  document.getElementById('btnResetLes'),
    btnGenMaps: document.getElementById('btnGenMaps')
  };

  els.start?.addEventListener('change', syncEnd);
  els.duur?.addEventListener('input', syncEnd);

  function syncEnd() {
    if (els.start?.value && els.duur?.value) {
      els.einde.value = computeEndISO(els.start.value, els.duur.value);
    }
  }

  els.btnGenMaps?.addEventListener('click', () => {
    if (!els.locMaps?.value && els.locNaam?.value) {
      els.locMaps.value = toMapsUrl(els.locNaam.value);
    }
  });

  els.btnReset?.addEventListener('click', () => {
    formLes?.reset();
    if (els.id) els.id.value = '';
  });

  els.btnDelete?.addEventListener('click', () => {
    const id = els.id?.value;
    if (id) {
      if (confirm('Les verwijderen?')) {
        deleteLesson(id);
        formLes.reset();
        if (els.id) els.id.value = '';
        renderLessen();
        renderAgenda();
      }
    } else {
      alert('Geen les geselecteerd.');
    }
  });

  formLes?.addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = {
      title: els.titel?.value.trim(),
      startISO: els.start?.value,
      durationMin: Number(els.duur?.value),
      endISO: els.einde?.value,
      trainers: els.trainers?.value.split(','),
      location: { name: els.locNaam?.value.trim(), mapsUrl: els.locMaps?.value.trim() }
    };
    if (!payload.title || !payload.startISO) {
      alert('Titel en start zijn verplicht.');
      return;
    }
    const existingId = els.id?.value;
    if (existingId) {
      const obj = { id: existingId, type: 'les', status: 'active', ...payload };
      updateLesson(obj);
    } else {
      const id = addLesson(createLesson(payload));
      if (els.id) els.id.value = id;
    }
    renderLessen();
    renderAgenda();
  });

  const lessenList = document.getElementById('lessenList');

  function renderLessen() {
    if (!lessenList) return;
    const list = listLessons();
    if (list.length === 0) {
      lessenList.innerHTML = `<li class="muted">Nog geen lessen…</li>`;
      return;
    }
    lessenList.innerHTML = '';
    list.forEach(l => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>
          <strong>${escapeHTML(l.title)}</strong>
          <span class="mono">(${l.startISO.replace('T',' ')} → ${l.endISO.replace('T',' ')})</span>
        </span>
        <a class="badge les" href="../lessen/detail.html?id=${encodeURIComponent(l.id)}" title="Detail">detail</a>
        <button data-act="edit">Bewerk</button>
        <button data-act="del" class="danger">Verwijderen</button>
      `;
      li.querySelector('[data-act="edit"]')?.addEventListener('click', () => {
        fillLesForm(l);
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        document.querySelector('.tab[data-tab="beheer"]')?.classList.add('active');
        document.getElementById('beheer')?.classList.add('active');
      });
      li.querySelector('[data-act="del"]')?.addEventListener('click', () => {
        if (confirm('Les verwijderen?')) {
          deleteLesson(l.id);
          renderLessen();
          renderAgenda();
        }
      });
      lessenList.appendChild(li);
    });
  }

  function fillLesForm(l) {
    if (!formLes) return;
    els.id.value = l.id;
    els.titel.value = l.title;
    els.start.value = l.startISO;
    els.duur.value = l.durationMin;
    els.einde.value = l.endISO;
    els.trainers.value = l.trainers.join(', ');
    els.locNaam.value = l.location?.name || '';
    els.locMaps.value = l.location?.mapsUrl || '';
  }

  const elsR = {
    pak: document.getElementById('pakNaam'),
    reeks: document.getElementById('reeksNaam'),
    start: document.getElementById('reeksStart'),
    startT: document.getElementById('reeksStartTijd'),
    aantal: document.getElementById('reeksAantal'),
    duur: document.getElementById('reeksDuur'),
    interval: document.getElementById('reeksInterval'),
    trainers: document.getElementById('reeksTrainers'),
    locNaam: document.getElementById('reeksLocNaam'),
    locMaps: document.getElementById('reeksLocMaps'),
    btnMaps: document.getElementById('btnGenMapsReeks'),
    btnGen: document.getElementById('btnGenReeks'),
    preview: document.getElementById('previewReeks')
  };

  elsR.btnMaps?.addEventListener('click', () => {
    if (!elsR.locMaps?.value && elsR.locNaam?.value) {
      elsR.locMaps.value = toMapsUrl(elsR.locNaam.value);
    }
  });

  elsR.btnGen?.addEventListener('click', () => {
    const data = {
      pakNaam:   elsR.pak?.value.trim(),
      reeksNaam: elsR.reeks?.value.trim(),
      startDate: elsR.start?.value,
      startTime: elsR.startT?.value,
      count:     Number(elsR.aantal?.value),
      intervalDays: Number(elsR.interval?.value),
      durationMin: Number(elsR.duur?.value),
      trainers: elsR.trainers?.value.split(',').map(s => s.trim()).filter(Boolean),
      loc: { name: elsR.locNaam?.value.trim(), mapsUrl: elsR.locMaps?.value.trim() }
    };
    if (!data.pakNaam || !data.reeksNaam || !data.startDate) {
      alert('Vul pakket, reeks en start in.');
      return;
    }

    const gen = generateSeries(data);
    if (elsR.preview) {
      elsR.preview.innerHTML = '';
      gen.lessons.forEach(l => {
        const li = document.createElement('li');
        li.textContent = `${l.title} — ${l.startISO.replace('T',' ')} (${l.durationMin}m)`;
        elsR.preview.appendChild(li);
      });
    }

    gen.lessons.forEach(addLesson);
    renderLessen();
    renderAgenda();
    alert(`Aangemaakt: ${gen.lessons.length} lessen in reeks "${gen.series.name}".`);
  });

  const formMed = document.getElementById('formMededeling');
  const medList = document.getElementById('medList');

  formMed?.addEventListener('submit', (e) => {
    e.preventDefault();
    const n = createNotice({
      title: document.getElementById('medTitel')?.value.trim(),
      message: document.getElementById('medBericht')?.value.trim(),
      dateISO: document.getElementById('medDatum')?.value,
      color: document.getElementById('medKleur')?.value
    });
    addNotice(n);
    formMed.reset();
    renderMededelingen();
    renderAgenda();
  });

  function renderMededelingen() {
    if (!medList) return;
    const list = listNotices();
    medList.innerHTML = '';
    if (list.length === 0) {
      medList.innerHTML = `<li class="card-item muted">Nog geen mededelingen…</li>`;
      return;
    }
    list.forEach(n => {
      const li = document.createElement('li');
      li.className = 'card-item';
      li.style.borderColor = n.color;
      li.innerHTML = `
        <div class="title"><span class="badge med" style="background:${n.color}">Mededeling</span> ${escapeHTML(n.title)}</div>
        <div class="meta">${n.dateISO}</div>
        <div>${escapeHTML(n.message)}</div>
        <div class="row">
          <a class="accent" href="../mededeling/detail.html?id=${encodeURIComponent(n.id)}">detail</a>
        </div>
      `;
      medList.appendChild(li);
    });
  }

  function renderAgenda() {
    if (!agendaList) return;

    const scope = document.querySelector('.subtab.active')?.dataset.scope || 'week';
    const from = new Date((agendaStart?.value || new Date().toISOString().slice(0,10)) + 'T00:00');
    const to   = new Date(from);
    if (scope === 'week') to.setDate(to.getDate() + 7);

    const items = buildAgenda().filter(item => {
      if (scope === 'mededelingen') return item.type === 'mededeling';
      if (scope === 'alles') return true;
      const d = new Date(item.dateISO);
      return d >= from && d < to;
    });

    agendaList.innerHTML = '';
    if (items.length === 0) {
      agendaList.innerHTML = `<li class="card-item muted">Geen items voor geselecteerde filter.</li>`;
      return;
    }

    items.forEach(it => {
      const li = document.createElement('li');
      li.className = 'card-item';
      const when = it.type === 'les'
        ? `${it.startISO.replace('T',' ')} → ${it.endISO.replace('T',' ')}`
        : `${it.dateISO}`;
      const link = it.type === 'les'
        ? `../lessen/detail.html?id=${encodeURIComponent(it.id)}`
        : `../mededeling/detail.html?id=${encodeURIComponent(it.id)}`;
      const badgeClass = it.type === 'les' ? 'les' : 'med';
      const color = it.color ?? (it.type === 'les' ? '#4fd1c5' : '#ffd166');

      li.style.borderColor = color;
      li.innerHTML = `
        <div class="row" style="justify-content:space-between">
          <span class="title"><span class="badge ${badgeClass}" style="background:${color}">${it.type}</span> ${escapeHTML(it.title)}</span>
          <a class="accent" href="${link}">detail</a>
        </div>
        <div class="meta">${when}</div>
        ${it.type === 'les' && it.location?.name ? `<div class="meta">📍 <a href="${it.location.mapsUrl||'#'}" target="_blank" rel="noopener">${escapeHTML(it.location.name)}</a></div>` : ''}
        ${it.type === 'les' && it.trainers?.length ? `<div class="meta">👥 ${it.trainers.map(escapeHTML).join(', ')}</div>` : ''}
        ${it.type === 'mededeling' && it.message ? `<div>${escapeHTML(it.message)}</div>` : ''}
      `;
      agendaList.appendChild(li);
    });
  }

  // Init seed + render
  function ensureDemoSeed() {
    const db = loadDB();
    if (!db.lessons.length && !db.notices.length) {
      const today = new Date(); today.setHours(18,0,0,0);
      const demo = createLesson({
        title: 'Proefles Puppy',
        startISO: today.toISOString().slice(0,16),
        durationMin: 60,
        endISO: null,
        trainers: ['Sam', 'Kim'],
        location: { name: 'Superhond Club', mapsUrl: toMapsUrl('Superhond Club') }
      });
      db.lessons.push(demo);
      db.notices.push(createNotice({
        title: 'Welkom!',
        message: 'Agenda + mededelingen gekoppeld ✔️',
        dateISO: new Date().toISOString().slice(0,10),
        color: '#ffd166'
      }));
      saveDB(db);
    }
  }

  ensureDemoSeed();
  renderLessen();
  renderMededelingen();
  renderAgenda();
});

// Exporteer indien nodig
export {};  // alleen zodat het als module wordt beschouwd
