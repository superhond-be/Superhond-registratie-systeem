// Lessenreeks – detail + gekoppelde lessen uit localStorage
(() => {
  const S = v => String(v ?? '');
  const $ = s => document.querySelector(s);

  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Lessenreeks', icon: '📦', back: './' });
    }
  });

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const box = $('#detail');
  const tbody = $('#lessonsBody');

  function loadDB() {
    try {
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      db.series  = Array.isArray(db.series)  ? db.series  : [];
      db.lessons = Array.isArray(db.lessons) ? db.lessons : [];
      return db;
    } catch {
      return { series:[], lessons:[] };
    }
  }

  function fmtDateRange(sISO, eISO) {
    const s = sISO ? new Date(sISO) : null;
    const e = eISO ? new Date(eISO) : null;
    if (!s) return '—';
    const d2 = n => String(n).padStart(2,'0');
    const date = `${d2(s.getDate())}/${d2(s.getMonth()+1)}/${s.getFullYear()}`;
    const t1   = `${d2(s.getHours())}:${d2(s.getMinutes())}`;
    const t2   = e ? `${d2(e.getHours())}:${d2(e.getMinutes())}` : '';
    return e ? `${date}, ${t1} — ${t2}` : `${date}, ${t1}`;
  }

  function rowLesson(l){
    const locName = l.location?.name || '—';
    const locUrl  = l.location?.mapsUrl;
    const trainers = Array.isArray(l.trainers) ? l.trainers : [];
    return `
      <tr>
        <td>${S(l.title || 'Les')}</td>
        <td>${fmtDateRange(l.startISO, l.endISO)}</td>
        <td>${locUrl ? `<a href="${locUrl}" target="_blank" rel="noopener">${S(locName)}</a>` : S(locName)}</td>
        <td>${trainers.length ? trainers.map(S).map(t=>`<span class="badge">${t}</span>`).join(' ') : '—'}</td>
      </tr>
    `;
  }

  function euro(n){
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(Number(n));
  }

  function render(series, lessons){
    box.innerHTML = `
      <h2 style="margin-top:0">${S(series.name)}</h2>
      <ul>
        <li><strong>Thema:</strong> ${S(series.thema || '—')}</li>
        <li><strong>Aantal lessen:</strong> ${Number(series.count || lessons.length) || 0}</li>
        <li><strong>Prijs:</strong> ${series.price != null ? euro(series.price) : '—'}</li>
      </ul>
    `;
    tbody.innerHTML = lessons.map(rowLesson).join('') || `<tr><td colspan="4" class="muted">Geen lessen gekoppeld.</td></tr>`;
  }

  function init(){
    if (!id) { box.textContent = 'Geen id opgegeven.'; return; }

    const db = loadDB();
    const series = db.series.find(r => String(r.id) === String(id));
    if (!series) {
      box.innerHTML = `<p class="error">Reeks met id <code>${S(id)}</code> niet gevonden.</p>`;
      return;
    }
    const lessons = db.lessons.filter(l => String(l.seriesId) === String(id))
      .sort((a,b) => String(a.startISO).localeCompare(String(b.startISO)));

    render(series, lessons);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
