// Agenda – tabs + data + filtering
(function () {
  const TABS = document.querySelectorAll('#agenda-tabs .tab');
  const loader = document.getElementById('agenda-loader');
  const errorBox = document.getElementById('agenda-error');
  const tableWrap = document.getElementById('agenda-table-wrap');
  const tbody = document.querySelector('#agenda-table tbody');

  const S = v => String(v ?? '');
  const bust = () => '?t=' + Date.now();

  async function fetchJson(tryUrls) {
    for (const u of tryUrls) {
      const r = await fetch(u + bust(), { cache: 'no-store' });
      if (r.ok) return r.json();
    }
    throw new Error('Geen data-bron bereikbaar (' + tryUrls.join(', ') + ')');
  }

  function toDate(x) {
    // accepteer '2025-10-15T10:00', '2025-10-15 10:00', of '2025-10-15'
    if (!x) return null;
    return new Date(String(x).replace(' ', 'T'));
  }

  function fmtDateRange(startISO, endISO) {
    const s = toDate(startISO), e = toDate(endISO);
    if (!s) return '—';
    const d2 = n => String(n).padStart(2, '0');
    const date = `${d2(s.getDate())}/${d2(s.getMonth()+1)}/${s.getFullYear()}`;
    const t = `${d2(s.getHours())}:${d2(s.getMinutes())}`;
    if (e) {
      const t2 = `${d2(e.getHours())}:${d2(e.getMinutes())}`;
      return `${date}, ${t} — ${t2}`;
    }
    return `${date}, ${t}`;
  }

  function isThisWeek(startISO) {
    const s = toDate(startISO);
    if (!s) return false;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // vandaag 00:00
    const end = new Date(start); end.setDate(end.getDate() + 7);              // +7 dagen
    return s >= start && s < end;
  }

  function rowForLesson(item) {
    const title = S(item.title || item.name);
    const href = item.id ? `../lessen/detail.html?id=${encodeURIComponent(item.id)}` : '#';
    const locName = item.location?.name || '—';
    const locUrl  = item.location?.mapsUrl;
    const trainers = Array.isArray(item.trainers) ? item.trainers : [];
    return `
      <tr>
        <td><a href="${href}">${title}</a></td>
        <td>${fmtDateRange(item.startISO || item.start, item.endISO || item.end)}</td>
        <td>${locUrl ? `<a href="${locUrl}" target="_blank" rel="noopener">${S(locName)}</a>` : S(locName)}</td>
        <td>${trainers.length ? trainers.map(S).map(t=>`<span class="badge">${t}</span>`).join(' ') : '—'}</td>
      </tr>
    `;
  }

  function rowForNotice(n) {
    const title = S(n.title || n.name);
    const href = n.id ? `../mededeling/detail.html?id=${encodeURIComponent(n.id)}` : '#';
    const when = S(n.dateISO || n.date || '—');
    return `
      <tr>
        <td>📢 <a href="${href}">${title}</a></td>
        <td>${when}</td>
        <td>—</td>
        <td>—</td>
      </tr>
    `;
  }

  function render(scope, data) {
    // data: verwacht { lessons:[], notices:[] } of één gemengde lijst
    const lessons = data.lessons || (data.items || data).filter?.(x => (x.type || 'les') !== 'mededeling') || [];
    const notices = data.notices || (data.items || data).filter?.(x => (x.type || 'les') === 'mededeling') || [];

    let rows = '';
    if (scope === 'mededelingen') {
      rows = notices
        .slice()
        .sort((a,b) => S(b.dateISO||b.date).localeCompare(S(a.dateISO||a.date)))
        .map(rowForNotice).join('');
    } else {
      const source = lessons
        .slice()
        .sort((a,b) => S(a.startISO||a.start).localeCompare(S(b.startISO||b.start)));
      const filtered = scope === 'week'
        ? source.filter(x => isThisWeek(x.startISO || x.start))
        : source;
      rows = filtered.map(rowForLesson).join('');
    }

    tbody.innerHTML = rows || `<tr><td colspan="4" class="muted">Geen items gevonden.</td></tr>`;
    loader.textContent = '';
    errorBox.style.display = 'none';
    tableWrap.style.display = 'block';
  }

  async function init() {
    try {
      loader.textContent = '⏳ Data laden…';
      tableWrap.style.display = 'none';
      errorBox.style.display = 'none';

      // API → fallback JSON
      const agenda = await fetchJson(['../api/agenda', '../data/agenda.json']);

      // start met 'alles'
      render('alles', agenda);

      // tab events
      TABS.forEach(btn => {
        btn.addEventListener('click', () => {
          TABS.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          render(btn.dataset.tab, agenda);
        });
      });

    } catch (e) {
      console.error(e);
      loader.textContent = '';
      tableWrap.style.display = 'none';
      errorBox.textContent = '⚠️ Kon agenda niet laden. ' + (e.message || e);
      errorBox.style.display = 'block';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
