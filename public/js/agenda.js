// /public/js/agenda.js
// Agenda – API/JSON baseline + localStorage lessen (merge) + tabs + kalenderweek + dedupe
(function () {
  const TABS = document.querySelectorAll('#agenda-tabs .tab');
  const loader = document.getElementById('agenda-loader');
  const errorBox = document.getElementById('agenda-error');
  const tableWrap = document.getElementById('agenda-table-wrap');
  const tbody = document.querySelector('#agenda-table tbody');

  const S = v => String(v ?? '');
  const bust = () => '?t=' + Date.now();

  // ---------- I/O helpers ----------
  async function fetchJson(tryUrls) {
    for (const u of tryUrls) {
      try {
        const r = await fetch(u + bust(), { cache: 'no-store' });
        if (r.ok) return r.json();
      } catch (_) {}
    }
    return null;
  }

  function loadLocalLessons() {
    try {
      const raw = localStorage.getItem('superhond-db');
      const db = raw ? JSON.parse(raw) : {};
      return Array.isArray(db?.lessons) ? db.lessons : [];
    } catch { return []; }
  }

  // ---------- Normalisatie ----------
  function normalizeAgenda(raw) {
    // accepteert: array of object met {lessons, notices} of {items}
    if (!raw) return { lessons: [], notices: [] };

    // 1) als array: split op type
    if (Array.isArray(raw)) return splitArray(raw);

    // 2) als object
    if (Array.isArray(raw.lessons) || Array.isArray(raw.notices)) {
      return {
        lessons: Array.isArray(raw.lessons) ? raw.lessons : [],
        notices: Array.isArray(raw.notices) ? raw.notices : [],
      };
    }
    if (Array.isArray(raw.items)) return splitArray(raw.items);
    if (Array.isArray(raw.data))  return splitArray(raw.data);

    return { lessons: [], notices: [] };
  }

  function splitArray(arr) {
    const lessons = [];
    const notices = [];
    for (const it of arr) {
      const t = (it.type || it.kind || 'les').toLowerCase();
      if (t === 'mededeling' || t === 'notice') notices.push(it);
      else lessons.push(it);
    }
    return { lessons, notices };
  }

  // ---------- Utils ----------
  function toDate(x) { return x ? new Date(String(x).replace(' ', 'T')) : null; }

  // Kalenderweek: maandag 00:00 t/m volgende maandag (excl.)
  function isThisWeek(startISO) {
    const s = toDate(startISO);
    if (!s) return false;
    const now = new Date();
    const day = (now.getDay() + 6) % 7; // ma=0..zo=6
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    weekStart.setDate(weekStart.getDate() - day);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return s >= weekStart && s < weekEnd;
  }

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

  // Deduplicatie: key op (id || title) + startISO
  function dedupeLessons(list) {
    const keyOf = x => {
      const id = S(x.id || x.lessonId || x._id || x.title || x.name);
      const start = S(x.startISO || x.start || x.startDate || x.begin);
      return id + '|' + start;
    };
    const map = new Map();
    for (const it of list) map.set(keyOf(it), it);
    return Array.from(map.values());
  }

  // ---------- Row builders ----------
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

  // ---------- Renderer ----------
  function render(scope, data) {
    const lessons = data.lessons.slice()
      .sort((a,b) => S(a.startISO||a.start||a.startDate).localeCompare(S(b.startISO||b.start||b.startDate)));
    const notices = data.notices.slice()
      .sort((a,b) => S(b.dateISO||b.date||b.datum).localeCompare(S(a.dateISO||a.date||a.datum)));

    let rows = '';

    if (scope === 'mededelingen') {
      rows = notices.map(rowForNotice).join('');
    } else {
      let list = (scope === 'week')
        ? lessons.filter(x => isThisWeek(x.startISO || x.start || x.startDate))
        : lessons;

      // Fallback in 'week': toon eerstvolgende 5 lessen als de kalenderweek leeg is
      if (scope === 'week' && list.length === 0) {
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const upcoming = lessons.filter(x => {
          const d = toDate(x.startISO || x.start || x.startDate);
          return d && d >= startOfToday;
        }).slice(0, 5);
        if (upcoming.length) {
          rows = upcoming.map(rowForLesson).join('') +
            `<tr><td colspan="4" class="muted">Geen items in deze kalenderweek — tonen eerstvolgende lessen.</td></tr>`;
        }
      } else {
        rows = list.map(rowForLesson).join('');
      }
    }

    tbody.innerHTML = rows || `<tr><td colspan="4" class="muted">Geen items gevonden.</td></tr>`;
    loader.textContent = '';
    errorBox.style.display = 'none';
    tableWrap.style.display = 'block';
  }

  // ---------- Init ----------
  async function init() {
    try {
      loader.textContent = '⏳ Data laden…';
      tableWrap.style.display = 'none';
      errorBox.style.display = 'none';

      // 1) baseline (API → fallback JSON)
      const raw = await fetchJson([
        '../api/agenda', '/api/agenda',
        '../data/agenda.json', '/data/agenda.json'
      ]);
      const base = normalizeAgenda(raw);

      // 2) localStorage-lessen inladen en normaliseren als 'lessons'
      const localLessons = loadLocalLessons();
      const mergedLessons = dedupeLessons([
        ...base.lessons,
        ...localLessons
      ]);

      const merged = { lessons: mergedLessons, notices: base.notices };

      // Start op "alles"
      render('alles', merged);

      // Tab events
      TABS.forEach(btn => {
        btn.addEventListener('click', () => {
          TABS.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          render(btn.dataset.tab, merged);
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
