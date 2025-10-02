// detail.js — Lessenreeks detail + lessen-generator + export
(() => {
  const $  = s => document.querySelector(s);
  const S  = v => String(v ?? '').trim();

  const els = {
    loader: $('#loader'),
    error:  $('#error'),
    box:    $('#box'),
    actions:$('#actions'),
    btnRegen: $('#btnRegen'),
    btnExpR:  $('#btnExportReeksen'),
    btnExpL:  $('#btnExportLessen'),
  };

  // topbar/footer
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Lessenreeks – Detail', icon:'📦', back:'./' });
    }
  });

  // ---- utils ----
  const bust = () => '?t=' + Date.now();
  async function fetchJson(tryUrls) {
    for (const u of tryUrls) {
      try {
        const r = await fetch(u + bust(), { cache:'no-store' });
        if (r.ok) return r.json();
      } catch (_) {}
    }
    return null;
  }
  function q(id){ return new URL(location.href).searchParams.get(id); }

  function escapeHTML(s='') {
    return String(s)
      .replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  // localStorage db
  function loadDB() {
    try {
      const raw = localStorage.getItem('superhond-db');
      const db = raw ? JSON.parse(raw) : {};
      db.series  = Array.isArray(db.series)  ? db.series  : [];
      db.lessons = Array.isArray(db.lessons) ? db.lessons : [];
      return db;
    } catch {
      return { series:[], lessons:[] };
    }
  }
  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }
  function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2,9); }

  // normalizer (zoals in overzicht)
  function normalizeSeries(raw){
    const arr =
      Array.isArray(raw) ? raw :
      Array.isArray(raw?.items) ? raw.items :
      Array.isArray(raw?.data)  ? raw.data  :
      Array.isArray(raw?.reeksen) ? raw.reeksen :
      Array.isArray(raw?.series)  ? raw.series  :
      Array.isArray(raw?.lessenreeks) ? raw.lessenreeks :
      [];
    return arr.map(r => ({
      id:      r.id ?? r.reeksId ?? r.seriesId ?? null,
      packageName: r.packageName ?? r.pakket ?? r.pkg ?? r.naam ?? r.name ?? '',
      seriesName:  r.seriesName  ?? r.reeks   ?? r.serie ?? '',
      theme:   r.theme ?? r.thema ?? '',
      count:   Number(r.count ?? r.aantal ?? r.lessonsCount ?? (Array.isArray(r.lessons)?r.lessons.length:0)) || 0,
      price:   Number(r.price ?? r.prijs ?? 0),
      startDate: S(r.startDate ?? r.start_datum ?? ''),
      startTime: S(r.startTime ?? r.start_tijd ?? '18:00'),
      durationMin: Number(r.durationMin ?? r.duur ?? 60),
      intervalDays: Number(r.intervalDays ?? r.interval ?? 7),
      trainers: Array.isArray(r.trainers) ? r.trainers
               : S(r.trainers||'').split(',').map(s=>s.trim()).filter(Boolean),
      locationName: S(r.location?.name ?? r.locatie ?? r.locationName ?? ''),
      locationMaps: S(r.location?.mapsUrl ?? r.mapsUrl ?? r.locationMaps ?? ''),
      createdAt: r.createdAt ?? new Date().toISOString()
    }));
  }

  // generator helpers
  function dtISO(dateStr, timeStr) {
    const t = (S(timeStr) || '00:00').padEnd(5, ':00');
    return `${S(dateStr)}T${t}`;
  }
  function addDays(isoDate, days) {
    const d = new Date(isoDate);
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function withDuration(startISO, minutes) {
    const s = new Date(startISO);
    const e = new Date(s.getTime() + (Number(minutes)||0) * 60000);
    const pad = n => String(n).padStart(2,'0');
    return `${e.getFullYear()}-${pad(e.getMonth()+1)}-${pad(e.getDate())}T${pad(e.getHours())}:${pad(e.getMinutes())}:00`;
  }
  function titleFor(pkg, series, idx, total) {
    return `${pkg} — ${series} (les ${idx}/${total})`;
  }
  function generateLessons(series){
    const out = [];
    let date = series.startDate;
    for (let i=1; i<=series.count; i++) {
      const id = uid('les');
      const startISO = dtISO(date, series.startTime);
      const endISO = withDuration(startISO, series.durationMin);
      out.push({
        id,
        seriesId: series.id,
        type: 'les',
        title: titleFor(series.packageName, series.seriesName, i, series.count),
        startISO,
        endISO,
        trainers: (series.trainers||[]).slice(),
        location: { name: series.locationName||'', mapsUrl: series.locationMaps||'' }
      });
      date = addDays(date, series.intervalDays);
    }
    return out;
  }

  // view
  function euro(n){ return new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(Number(n||0)); }

  function render(series) {
    const meta = [
      series.theme ? `Thema: ${escapeHTML(series.theme)}` : null,
      `${series.count} lessen • duur ${series.durationMin} min • elke ${series.intervalDays} dagen`,
      series.startDate ? `Start: ${escapeHTML(series.startDate)} ${escapeHTML(series.startTime)}` : null,
      series.price ? `Prijs: ${euro(series.price)}` : null
    ].filter(Boolean).join(' — ');

    const lessons = generateLessons(series);

    els.box.innerHTML = `
      <h2 style="margin-top:0">${escapeHTML(series.packageName)} — ${escapeHTML(series.seriesName)}</h2>
      <p class="muted">${meta}</p>
      <h3>Gegenereerde lessen</h3>
      <ol style="margin:0;padding-left:1.2rem">
        ${lessons.map(l => `
          <li>${escapeHTML(l.title)} — ${l.startISO.replace('T',' ')} → ${l.endISO.replace('T',' ')}</li>
        `).join('')}
      </ol>
      ${series.locationName ? `
        <p style="margin-top:8px"><strong>Locatie:</strong>
          ${series.locationMaps
            ? `<a href="${series.locationMaps}" target="_blank" rel="noopener">${escapeHTML(series.locationName)}</a>`
            : escapeHTML(series.locationName)}
        </p>
      `:''}
      ${series.trainers?.length ? `<p><strong>Trainers:</strong> ${series.trainers.map(escapeHTML).join(', ')}</p>`:''}
    `;
    els.box.style.display = '';
    els.actions.style.display = '';
    els.loader.style.display = 'none';
  }

  function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data,null,2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function init() {
    try {
      const id = q('id');
      if (!id) throw new Error('Geen id opgegeven.');

      // 1) extern zoeken
      const raw = await fetchJson([
        `../api/lessenreeks?id=${encodeURIComponent(id)}`,
        `/api/lessenreeks?id=${encodeURIComponent(id)}`,
        '../data/lessenreeks.json',
        '/data/lessenreeks.json'
      ]);
      let series = [];
      if (raw) series = normalizeSeries(raw);

      // 2) localStorage fallback/merge
      const db = loadDB();
      const localSeries = normalizeSeries({ series: db.series });
      const all = [...localSeries, ...series];

      const s = all.find(x => String(x.id) === String(id));
      if (!s) throw new Error(`Lessenreeks met id ${id} niet gevonden.`);

      render(s);

      // actions
      els.btnRegen.addEventListener('click', () => {
        const regen = generateLessons(s);
        const map = new Map(db.lessons.map(x => [String(x.id), x]));
        // voeg toe (nieuwe ids)
        for (const l of regen) map.set(String(l.id), l);
        db.lessons = Array.from(map.values());
        saveDB(db);
        alert(`Lessen opnieuw gegenereerd en opgeslagen (${regen.length}).`);
      });

      els.btnExpR.addEventListener('click', () => {
        downloadJSON('reeksen.json', db.series);
      });
      els.btnExpL.addEventListener('click', () => {
        downloadJSON('lessen.json', db.lessons);
      });

    } catch (e) {
      els.loader.style.display = 'none';
      els.error.style.display  = '';
      els.error.textContent    = '⚠️ ' + (e.message || e);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
