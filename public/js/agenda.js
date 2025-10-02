// Agenda – robuuste loader + tabs + filtering (kalenderweek + week-fallback)
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
      try {
        const r = await fetch(u + bust(), { cache: 'no-store' });
        if (r.ok) return r.json();
      } catch (_) {}
    }
    throw new Error('Geen data-bron bereikbaar (' + tryUrls.join(', ') + ')');
  }

  // ---- Normalisatie van verschillende agenda-vormen ----
  function normalize(raw) {
    if (Array.isArray(raw)) return split(raw); // kale array

    const keys = ['items', 'agenda', 'data'];
    for (const k of keys) {
      if (Array.isArray(raw?.[k])) return split(raw[k]);
    }
    if (Array.isArray(raw?.lessons) || Array.isArray(raw?.notices)) {
      return {
        lessons: Array.isArray(raw.lessons) ? raw.lessons : [],
        notices: Array.isArray(raw.notices) ? raw.notices : []
      };
    }
    return { lessons: [], notices: [] };
  }

  function split(arr) {
    const lessons = [];
    const notices = [];
    for (const it of arr) {
      const type = (it.type || it.kind || '').toLowerCase();
      if (type === 'mededeling' || type === 'notice') notices.push(it);
      else lessons.push(it);
    }
    return { lessons, notices };
  }

  // ---- Helpers ----
  function toDate(x) { return x ? new Date(String(x).replace(' ', 'T')) : null; }

  function fmtDateRange(startISO, endISO) {
    const s = toDate(startISO), e = toDate(endISO);
    if (!s) return '—';
    const d2 = n => String(n).padStart(2, '0');
    const date = `${d2(s.getDate())}/${d2(s.getMonth()+1)}/${s.getFullYear()}`;
    const t1 = `${d2(s.getHours())}:${d2(s.getMinutes())}`;
    if (e) {
      const t2 = `${d2(e.getHours())}:${d2(e.getMinutes())}`;
      return `${date}, ${t1} — ${t2}`;
    }
    return `${date}, ${t1}`;
  }

  // Kalenderweek: maandag 00:00 t/m zondag 23:59
  function isThisWeek(startISO) {
    const s = toDate(startISO);
    if (!s) return false;

    const now = new Date();
    // 0=zo,1=ma,... → we willen maandag als start
    const day = (now.getDay() + 6) % 7;       // ma=0 ... zo=6
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    weekStart.setDate(weekStart.getDate() - day); // terug naar maandag 00:00

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);       // volgende maandag (exclusief)

    return s >= weekStart && s < weekEnd;
  }

  function rowForLesson(item) {
    const title = S(item.title || item.name);
    const href = item.id ? `../lessen/detail.html?id=${encodeURIComponent(item.id)}` : '#';
    const start = item.startISO || item.start || item.startDate || item.begin;
    const end   = item.endISO   || item.end   || item.endDate   || item.einde;

    const locName = item.location?.name || item.locatie || '—';
    const locUrl  = item.location?.mapsUrl || item.mapsUrl;

    const trainers = Array.isArray(item.trainers) ? item.trainers
                    : Array.isArray(item.trainer) ? item.trainer
                    : [];

    return `
      <tr>
        <td><a href="${href}">${title}</a></td>
        <td>${fmtDateRange(start, end)}</td>
        <td>${locUrl ? `<a href="${locUrl}" target="_blank" rel="noopener">${S(locName)}</a>` : S(locName)}</td>
        <td>${trainers.length ? trainers.map(S).map(t=>`<span class="badge">${t}</span>`).join(' ') : '—'}</td>
      </tr>
    `;
  }

  function rowForNotice(n) {
    const title = S(n.title || n.name);
    const href = n.id ? `../mededeling/detail.html?id=${encodeURIComponent(n.id)}` : '#';
    const when = S(n.dateISO || n.date || n.datum || '—');
    return `
      <tr>
        <td>📢 <a href="${href}">${title}</a></td>
        <td>${when}</td>
        <td>—</td>
        <td>—</td>
      </tr>
    `;
  }

  // render() toont content en geeft het aantal getoonde rijen terug
  function render(scope, norm) {
    const { lessons, notices } = norm;

    let rows = '';
    let count = 0;

    if (scope === 'mededelingen') {
      const list = notices
        .slice()
        .sort((a,b) => S(b.dateISO||b.date||b.datum).localeCompare(S(a.dateISO||a.date||a.datum)));
      rows = list.map(rowForNotice).join('');
      count = list.length;
    } else {
      const source = lessons
        .slice()
        .sort((a,b) => S(a.startISO||a.start||a.startDate).localeCompare(S(b.startISO||b.start||b.startDate)));

      let filtered = scope === 'week'
        ? source.filter(x => isThisWeek(x.startISO || x.start || x.startDate))
        : source;

      // ⭐ Fallback: als kalenderweek leeg is, toon eerstvolgende 5 lessen
      let hintRow = '';
      if (scope === 'week' && filtered.length === 0) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        filtered = source.filter(x => {
          const d = toDate(x.startISO || x.start || x.startDate);
          return d && d >= today;
        }).slice(0, 5);

        if (filtered.length) {
          hintRow = `<tr><td colspan="4" class="muted">Geen items in deze kalenderweek — tonen eerstvolgende lessen.</td></tr>`;
        }
      }

      rows = filtered.map(rowForLesson).join('');
      if (!rows) rows = `<tr><td colspan="4" class="muted">Geen items gevonden.</td></tr>`;
      if (hintRow) rows += hintRow;
      count = filtered.length;
    }

    tbody.innerHTML = rows;
    loader.textContent = '';
    errorBox.style.display = 'none';
    tableWrap.style.display = 'block';

    return count;
  }

  async function init() {
    try {
      loader.textContent = '⏳ Data laden…';
      tableWrap.style.display = 'none';
      errorBox.style.display = 'none';

      const raw = await fetchJson([
        '../api/agenda', '/api/agenda',
        '../data/agenda.json', '/data/agenda.json'
      ]);
      const norm = normalize(raw);

      // start met 'alles'
      render('alles', norm);

      // tab events
      TABS.forEach(btn => {
        btn.addEventListener('click', () => {
          TABS.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          render(btn.dataset.tab, norm);
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
