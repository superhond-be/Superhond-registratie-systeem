// Agenda – externe agenda + localStorage-lessen, tabs & filtering (kalenderweek)
// /public/js/agenda.js
(function () {
  // ------- DOM refs -------
  const TABS      = document.querySelectorAll('#agenda-tabs .tab');
  const loader    = document.getElementById('agenda-loader');
  const errorBox  = document.getElementById('agenda-error');
  const tableWrap = document.getElementById('agenda-table-wrap');
  const tbody     = document.querySelector('#agenda-table tbody');

  const S = v => String(v ?? '').trim();

  // ------- Fetch helper -------
  async function fetchJson(tryUrls) {
    for (const u of tryUrls) {
      try {
        const url = u + (u.includes('?') ? '&' : '?') + 't=' + Date.now();
        const r = await fetch(url, { cache: 'no-store' });
        if (r.ok) return r.json();
      } catch (_) {}
    }
    return null;
  }

  // ------- Normalisatie externe agenda -------
  function normalizeAgenda(raw) {
    if (!raw) return { lessons: [], notices: [] };

    const arr =
      Array.isArray(raw)       ? raw :
      Array.isArray(raw?.items)? raw.items :
      Array.isArray(raw?.data) ? raw.data : null;

    if (arr) {
      const lessons = [], notices = [];
      for (const it of arr) {
        const t = S(it.type || it.kind).toLowerCase();
        if (t === 'mededeling' || t === 'notice') notices.push(it);
        else lessons.push(it);
      }
      return { lessons, notices };
    }
    return {
      lessons: Array.isArray(raw?.lessons) ? raw.lessons : [],
      notices: Array.isArray(raw?.notices) ? raw.notices : []
    };
  }

  // ------- Lokale lessen: nieuwe bucket + legacy fallback -------
  function loadBucketLessons() {
    try {
      const raw = localStorage.getItem('superhond-lessons');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function loadLegacyLessons() {
    try {
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      return Array.isArray(db?.lessons) ? db.lessons : [];
    } catch { return []; }
  }

  function loadLocalLessons() {
    const bucket = loadBucketLessons();
    const legacy = loadLegacyLessons();
    // beide samenvoegen (dedupe later in merge)
    return [...bucket, ...legacy];
  }

  // ------- Merge: extern (primair) + lokaal (secundair), dedupe op id of start+title -------
  function mergeLessons(ext = [], loc = []) {
    const norm = (x) => ({
      id:       S(x.id || ''),
      title:    S(x.title || x.name || 'Les'),
      startISO: S(x.startISO || x.start || x.startDate || x.begin || ''),
      endISO:   S(x.endISO   || x.end   || x.endDate   || x.einde || ''),
      location: (x.location && typeof x.location === 'object')
        ? { name: S(x.location.name || x.location.naam || ''), mapsUrl: S(x.location.mapsUrl || '') || null }
        : { name: S(x.locatie || ''), mapsUrl: S(x.mapsUrl || '') || null },
      trainers: Array.isArray(x.trainers) ? x.trainers.slice() : []
    });

    const key = x => S(x.id) || (S(x.startISO) + '|' + S(x.title));
    const map = new Map();
    for (const e of ext.map(norm)) map.set(key(e), e);           // extern wint
    for (const l of loc.map(norm)) if (!map.has(key(l))) map.set(key(l), l);
    return [...map.values()];
  }

  // ------- Helpers -------
  function toDate(x) { return x ? new Date(String(x).replace(' ', 'T')) : null; }

  function fmtDateRange(startISO, endISO) {
    const s = toDate(startISO), e = toDate(endISO);
    if (!s || isNaN(s)) return '—';
    const d2 = n => String(n).padStart(2, '0');
    const date = `${d2(s.getDate())}/${d2(s.getMonth()+1)}/${s.getFullYear()}`;
    const t1 = `${d2(s.getHours())}:${d2(s.getMinutes())}`;
    if (e && !isNaN(e)) {
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
    const day = (now.getDay() + 6) % 7;          // ma=0 ... zo=6
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    weekStart.setDate(weekStart.getDate() - day); // maandag 00:00
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);       // volgende maandag (excl.)
    return s >= weekStart && s < weekEnd;
  }

  // ------- Rendering -------
  function rowForLesson(item) {
    const title   = S(item.title || item.name || 'Les');
    const href    = item.id ? `../lessen/detail.html?id=${encodeURIComponent(item.id)}` : '#';
    const locName = item.location?.name || '—';
    const locUrl  = item.location?.mapsUrl || '';
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
    const title = S(n.title || n.name || 'Mededeling');
    const href  = n.id ? `../mededeling/detail.html?id=${encodeURIComponent(n.id)}` : '#';
    const when  = S(n.dateISO || n.date || n.datum || '—');
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
    let rows = '';
    if (scope === 'mededelingen') {
      rows = (data.notices || [])
        .slice()
        .sort((a,b) => S(b.dateISO||b.date||b.datum).localeCompare(S(a.dateISO||a.date||a.datum)))
        .map(rowForNotice).join('');
    } else {
      const source = (data.lessons || [])
        .slice()
        .sort((a,b) => S(a.startISO||a.start).localeCompare(S(b.startISO||b.start)));
      const filtered = (scope === 'week')
        ? source.filter(x => isThisWeek(x.startISO || x.start))
        : source;
      rows = filtered.map(rowForLesson).join('');
    }

    tbody.innerHTML = rows || `<tr><td colspan="4" class="muted">Geen items gevonden.</td></tr>`;
    loader.textContent = '';
    errorBox.style.display = 'none';
    tableWrap.style.display = 'block';
  }

  // Optioneel: badge-bolletjes op tabs bijwerken als die in de HTML aanwezig zijn
  function updateTabDots(data) {
    const allCount  = (data.lessons || []).length;
    const weekCount = (data.lessons || []).filter(x => isThisWeek(x.startISO || x.start)).length;
    const noteCount = (data.notices || []).length;

    const w = document.getElementById('tab-week-dot');
    const a = document.getElementById('tab-all-dot');
    const n = document.getElementById('tab-notes-dot');
    if (w) w.textContent = String(weekCount);
    if (a) a.textContent = String(allCount);
    if (n) n.textContent = String(noteCount);
  }

  // ------- Init -------
  async function init() {
    try {
      loader.textContent = '⏳ Data laden…';
      tableWrap.style.display = 'none';
      errorBox.style.display = 'none';

      // 1) Externe agenda
      const extRaw = await fetchJson(['../api/agenda','/api/agenda','../data/agenda.json','/data/agenda.json']);
      const ext = normalizeAgenda(extRaw);

      // 2) Lokale lessen (bucket + legacy)
      const localLessons = loadLocalLessons();

      // 3) Merge & cache
      const merged = {
        lessons: mergeLessons(ext.lessons, localLessons),
        notices: ext.notices || []
      };

      // 4) Altijd starten op 'week'
      render('week', merged);

      // 5) Tab events
      TABS.forEach(btn => {
        btn.addEventListener('click', () => {
          TABS.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          render(btn.dataset.tab, merged);
        });
      });

      // 6) Tab-bolletjes
      updateTabDots(merged);

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
