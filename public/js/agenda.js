// Agenda – externe agenda + localStorage-lessen, tabs & badges (kalenderweek)
(function () {
  const TABS      = document.querySelectorAll('#agenda-tabs .tab');
  const loader    = document.getElementById('agenda-loader');
  const errorBox  = document.getElementById('agenda-error');
  const tableWrap = document.getElementById('agenda-table-wrap');
  const tbody     = document.querySelector('#agenda-table tbody');

  const badgeWeek    = document.getElementById('badge-week');
  const badgeAll     = document.getElementById('badge-all');
  const badgeNotices = document.getElementById('badge-notices');

  const S = v => String(v ?? '');
  const bust = u => u + (u.includes('?') ? '&' : '?') + 't=' + Date.now();

  async function fetchJson(tryUrls) {
    for (const u of tryUrls) {
      try {
        const r = await fetch(bust(u), { cache: 'no-store' });
        if (r.ok) return r.json();
      } catch (_){}
    }
    return null;
  }

  // ---- Externe agenda naar {lessons, notices} ----
  function normalizeAgenda(raw){
    if (!raw) return { lessons:[], notices:[] };

    const arr =
      Array.isArray(raw)       ? raw :
      Array.isArray(raw.items) ? raw.items :
      Array.isArray(raw.data)  ? raw.data :
      Array.isArray(raw.agenda)? raw.agenda : null;

    if (arr){
      const lessons = [], notices = [];
      for (const it of arr) {
        const type = S(it.type || it.kind).toLowerCase();
        (type === 'mededeling' || type === 'notice' ? notices : lessons).push({
          id:       S(it.id || ''),
          title:    S(it.title || it.name || 'Les'),
          startISO: S(it.startISO || it.start || it.startDate || it.begin || ''),
          endISO:   S(it.endISO   || it.end   || it.endDate   || it.einde || ''),
          location: it.location || null,
          trainers: Array.isArray(it.trainers) ? it.trainers : []
        });
      }
      return { lessons, notices };
    }

    const lessons = Array.isArray(raw.lessons) ? raw.lessons.map(x => ({
      id: S(x.id || ''), title: S(x.title || x.name || 'Les'),
      startISO: S(x.startISO || x.start || ''), endISO: S(x.endISO || x.end || ''),
      location: x.location || null, trainers: Array.isArray(x.trainers) ? x.trainers : []
    })) : [];

    const notices = Array.isArray(raw.notices) ? raw.notices.map(n => ({
      id: S(n.id || ''), title: S(n.title || n.name || ''), dateISO: S(n.dateISO || n.date || n.datum || '')
    })) : [];

    return { lessons, notices };
  }

  // ---- Lokale lessen uit localStorage ----
  function loadLocalLessons(){
    try{
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      const lessons = Array.isArray(db.lessons) ? db.lessons : [];
      return lessons.map(l => ({
        id:       S(l.id || ''),
        title:    S(l.title || l.name || 'Les'),
        startISO: S(l.startISO || l.start || ''),
        endISO:   S(l.endISO   || l.end   || ''),
        location: (l.location && typeof l.location === 'object')
                    ? { name:S(l.location.name), mapsUrl:S(l.location.mapsUrl) || null }
                    : { name:S(l.locatie || ''), mapsUrl:S(l.mapsUrl || '') || null },
        trainers: Array.isArray(l.trainers) ? l.trainers.slice() : []
      })).filter(x => x.startISO);
    }catch{ return []; }
  }

  // ---- Merge-lessen (externe wint bij id; anders uniq op start+title) ----
  function mergeLessons(ext = [], loc = []){
    const key = x => S(x.id) || (S(x.startISO)+'|'+S(x.title));
    const map = new Map();
    for (const e of ext) map.set(key(e), e);
    for (const l of loc) if (!map.has(key(l))) map.set(key(l), l);
    return [...map.values()];
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

  // Kalenderweek: ma 00:00 → volgende ma (excl.)
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

  // ---- Rendering ----
  function rowForLesson(item) {
    const title = S(item.title || 'Les');
    const href  = item.id ? `../lessen/detail.html?id=${encodeURIComponent(item.id)}` : '#';
    const locName = item.location?.name || '—';
    const locUrl  = item.location?.mapsUrl;
    const trainers = Array.isArray(item.trainers) ? item.trainers : [];
    return `
      <tr>
        <td><a href="${href}">${title}</a></td>
        <td>${fmtDateRange(item.startISO, item.endISO)}</td>
        <td>${locUrl ? `<a href="${locUrl}" target="_blank" rel="noopener">${S(locName)}</a>` : S(locName)}</td>
        <td>${trainers.length ? trainers.map(S).map(t=>`<span class="badge">${t}</span>`).join(' ') : '—'}</td>
      </tr>
    `;
  }

  function rowForNotice(n) {
    const title = S(n.title || '');
    const href  = n.id ? `../mededeling/detail.html?id=${encodeURIComponent(n.id)}` : '#';
    const when  = S(n.dateISO || '—');
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
      rows = data.notices
        .slice()
        .sort((a,b) => S(b.dateISO).localeCompare(S(a.dateISO)))
        .map(rowForNotice).join('');
    } else {
      const source = data.lessons
        .slice()
        .sort((a,b) => S(a.startISO).localeCompare(S(b.startISO)));
      const filtered = (scope === 'week')
        ? source.filter(x => isThisWeek(x.startISO))
        : source;
      rows = filtered.map(rowForLesson).join('');
    }

    tbody.innerHTML = rows || `<tr><td colspan="4" class="muted">Geen items gevonden.</td></tr>`;
    loader.textContent = '';
    errorBox.style.display = 'none';
    tableWrap.style.display = 'block';
  }

  function updateBadges(data){
    const countAll   = data.lessons.length;
    const countWeek  = data.lessons.filter(x => isThisWeek(x.startISO)).length;
    const countNotes = data.notices.length;

    if (badgeAll)     badgeAll.textContent = String(countAll);
    if (badgeWeek)    badgeWeek.textContent = String(countWeek);
    if (badgeNotices) badgeNotices.textContent = String(countNotes);
  }

  // ---- Init ----
  async function init() {
    try {
      loader.textContent = '⏳ Data laden…';
      tableWrap.style.display = 'none';
      errorBox.style.display = 'none';

      // 1) Externe agenda
      const extRaw = await fetchJson(['../api/agenda','/api/agenda','../data/agenda.json','/data/agenda.json']);
      const ext = normalizeAgenda(extRaw);

      // 2) Lokale lessen
      const localLessons = loadLocalLessons();

      // 3) Merge
      const merged = {
        lessons: mergeLessons(ext.lessons, localLessons),
        notices: ext.notices || []
      };

      // 4) Badges
      updateBadges(merged);

      // 5) Start met 'week' (jouw wens)
      render('week', merged);
      TABS.forEach(b => b.classList.remove('active'));
      document.querySelector('#agenda-tabs .tab[data-tab="week"]')?.classList.add('active');

      // 6) Klik events
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
