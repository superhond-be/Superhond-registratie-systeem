// /public/js/agenda.js
// Agenda – externe agenda + localStorage-lessen, tabs & filtering (kalenderweek) + trainers-voornamen
(function () {
  const TABS = document.querySelectorAll('#agenda-tabs .tab');
  const loader = document.getElementById('agenda-loader');
  const errorBox = document.getElementById('agenda-error');
  const tableWrap = document.getElementById('agenda-table-wrap');
  const tbody = document.querySelector('#agenda-table tbody');

  const S = v => String(v ?? '').trim();

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

  // ---- Trainers index (optioneel) ----
  // Verwachte vormen in trainers.json:
  // 1) { trainers:[ {id:'t1', name:'Paul Janssens'}, ... ] }
  // 2) { items:[ ... ] } / { data:[ ... ] } / array
  function buildTrainersIndex(raw) {
    const idx = new Map();
    if (!raw) return idx;

    const arr =
      Array.isArray(raw)        ? raw :
      Array.isArray(raw.items)  ? raw.items :
      Array.isArray(raw.data)   ? raw.data :
      Array.isArray(raw.trainers) ? raw.trainers : [];

    for (const t of arr) {
      const id   = S(t.id || t.trainerId || '');
      const name = S(t.name || t.naam || '');
      if (!id && !name) continue;
      const first = firstNameOnly(name);
      if (id) idx.set(id, first || name);
      // ook op naam indexeren (kan helpen bij normalisatie)
      if (name) idx.set(name.toLowerCase(), first || name);
    }
    return idx;
  }

  function firstNameOnly(name = '') {
    const cleaned = String(name).replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    // Pak het eerste "woord"; laat apostrof/accents ongemoeid
    return cleaned.split(' ')[0];
  }

  // Maak voornamen op basis van:
  // - item.trainers: array van strings → neem eerste woord
  // - item.trainers: array van {id/name} → map via trainersIndex, anders eerste woord
  // - item.trainerIds / item.trainer: array van ids → map via trainersIndex
  function getTrainerFirstNames(item, trainersIndex) {
    const out = [];
    const push = n => { const fn = firstNameOnly(n); if (fn) out.push(fn); };

    // 1) trainers als strings
    if (Array.isArray(item.trainers) && item.trainers.every(x => typeof x === 'string')) {
      item.trainers.forEach(push);
      return out;
    }

    // 2) trainers als objecten {id,name}
    if (Array.isArray(item.trainers) && item.trainers.length && typeof item.trainers[0] === 'object') {
      for (const t of item.trainers) {
        const id = S(t.id || '');
        const nm = S(t.name || t.naam || '');
        if (id && trainersIndex.has(id)) out.push(trainersIndex.get(id));
        else if (nm) {
          if (trainersIndex.has(nm.toLowerCase())) out.push(trainersIndex.get(nm.toLowerCase()));
          else push(nm);
        }
      }
      return out;
    }

    // 3) alternatieve velden: trainer / trainerIds
    const ids = Array.isArray(item.trainerIds) ? item.trainerIds
              : Array.isArray(item.trainer) && item.trainer.every(x => typeof x !== 'string') ? item.trainer.map(t=>t.id).filter(Boolean)
              : Array.isArray(item.trainer) ? item.trainer
              : [];

    if (Array.isArray(ids) && ids.length) {
      for (const id of ids) {
        const key = S(id);
        if (trainersIndex.has(key)) out.push(trainersIndex.get(key));
      }
      if (out.length) return out;
    }

    // 4) fallback: trainers als array van strings (misschien gemengd)
    if (Array.isArray(item.trainer)) {
      item.trainer.forEach(x => {
        const s = typeof x === 'string' ? x : (x?.name || x?.naam || '');
        if (!s) return;
        if (trainersIndex.has(s.toLowerCase())) out.push(trainersIndex.get(s.toLowerCase()));
        else push(s);
      });
      return out;
    }

    return out;
  }

  // ---- Normalisatie externe agenda ----
  function normalizeAgenda(raw) {
    const arr =
      Array.isArray(raw)            ? raw :
      Array.isArray(raw?.items)     ? raw.items :
      Array.isArray(raw?.data)      ? raw.data :
      Array.isArray(raw?.agenda)    ? raw.agenda : null;

    if (arr) {
      const lessons = [], notices = [];
      for (const it of arr) {
        const type = S(it.type || it.kind).toLowerCase();
        if (type === 'mededeling' || type === 'notice') notices.push(it);
        else lessons.push(it);
      }
      return { lessons, notices };
    }
    return {
      lessons: Array.isArray(raw?.lessons) ? raw.lessons : [],
      notices: Array.isArray(raw?.notices) ? raw.notices : []
    };
  }

  // ---- LocalStorage: haal lessen op en normaliseer ----
  function loadLocalLessons() {
    try {
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      const lessons = Array.isArray(db?.lessons) ? db.lessons : [];
      return lessons.map(l => ({
        id:      S(l.id),
        title:   S(l.title || l.name || 'Les'),
        startISO:S(l.startISO || l.start),
        endISO:  S(l.endISO   || l.end),
        location: (l.location && typeof l.location === 'object')
                    ? { name:S(l.location.name), mapsUrl:S(l.location.mapsUrl) || null }
                    : { name:S(l.locatie || ''), mapsUrl:S(l.mapsUrl || '') || null },
        trainers: Array.isArray(l.trainers) ? l.trainers.slice()
                 : Array.isArray(l.trainer) ? l.trainer.slice()
                 : []
      })).filter(x => x.startISO);
    } catch {
      return [];
    }
  }

  // ---- Merge: externe (primair) + lokaal (secundair), dedupe op id of start+title ----
  function mergeLessons(ext = [], loc = []) {
    const key = x => S(x.id) || (S(x.startISO) + '|' + S(x.title));
    const map = new Map();
    for (const e of ext) map.set(key(e), e);
    for (const l of loc) if (!map.has(key(l))) map.set(key(l), l);
    return Array.from(map.values());
  }

  // ---- Helpers ----
  function toDate(x) { return x ? new Date(String(x).replace(' ', 'T')) : null; }

  function fmtDateRange(startISO, endISO) {
    const s = toDate(startISO), e = toDate(endISO);
    if (!s) return '—';
    const d2 = n => String(n).padStart(2, '0');
    const date = `${d2(s.getDate())}/${d2(s.getMonth() + 1)}/${s.getFullYear()}`;
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
    const day = (now.getDay() + 6) % 7;          // ma=0 ... zo=6
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    weekStart.setDate(weekStart.getDate() - day); // maandag 00:00
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);       // volgende maandag (excl.)
    return s >= weekStart && s < weekEnd;
  }

  // ---- Rendering ----
  function rowForLesson(item, trainersIndex) {
    const title = S(item.title || item.name || 'Les');
    const href  = item.id ? `../lessen/detail.html?id=${encodeURIComponent(item.id)}` : '#';
    const locName = item.location?.name || '—';
    const locUrl  = item.location?.mapsUrl;

    const firsts = getTrainerFirstNames(item, trainersIndex);
    return `
      <tr>
        <td><a href="${href}">${title}</a></td>
        <td>${fmtDateRange(item.startISO || item.start, item.endISO || item.end)}</td>
        <td>${locUrl ? `<a href="${locUrl}" target="_blank" rel="noopener">${S(locName)}</a>` : S(locName)}</td>
        <td>${firsts.length ? firsts.map(t => `<span class="badge">${S(t)}</span>`).join(' ') : '—'}</td>
      </tr>
    `;
  }

  function rowForNotice(n) {
    const title = S(n.title || n.name);
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

  function render(scope, data, trainersIndex) {
    let rows = '';
    if (scope === 'mededelingen') {
      rows = data.notices
        .slice()
        .sort((a, b) => S(b.dateISO || b.date || b.datum).localeCompare(S(a.dateISO || a.date || a.datum)))
        .map(rowForNotice).join('');
    } else {
      const source = data.lessons
        .slice()
        .sort((a, b) => S(a.startISO || a.start).localeCompare(S(b.startISO || b.start)));
      const filtered = (scope === 'week')
        ? source.filter(x => isThisWeek(x.startISO || x.start))
        : source;
      rows = filtered.map(x => rowForLesson(x, trainersIndex)).join('');
    }

    tbody.innerHTML = rows || `<tr><td colspan="4" class="muted">Geen items gevonden.</td></tr>`;
    loader.textContent = '';
    errorBox.style.display = 'none';
    tableWrap.style.display = 'block';
  }

  // ---- Init ----
  async function init() {
    try {
      loader.textContent = '⏳ Data laden…';
      tableWrap.style.display = 'none';
      errorBox.style.display = 'none';

      // 0) Trainers-index (optioneel)
      const trainersRaw = await fetchJson(['../data/trainers.json','/data/trainers.json']);
      const trainersIndex = buildTrainersIndex(trainersRaw);

      // 1) Externe agenda
      const extRaw = await fetchJson(['../api/agenda', '/api/agenda', '../data/agenda.json', '/data/agenda.json']);
      const ext = normalizeAgenda(extRaw);

      // 2) Lokale lessen
      const localLessons = loadLocalLessons();

      // 3) Merge & cache
      const merged = {
        lessons: mergeLessons(ext.lessons, localLessons),
        notices: ext.notices || []
      };

      // 4) Start met 'alles'
      render('alles', merged, trainersIndex);

      // 5) Tab events
      TABS.forEach(btn => {
        btn.addEventListener('click', () => {
          TABS.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          render(btn.dataset.tab, merged, trainersIndex);
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
