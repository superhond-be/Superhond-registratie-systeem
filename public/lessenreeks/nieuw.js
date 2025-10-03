// Nieuwe lessenreeks – snelle klassen-lader + autofill + veilig opslaan
import {
  ensureMigrated,
  getKlassen,
  getReeksen,
  setReeksen,
  getLessen,
  setLessen,
  isActiefStatus
} from '../js/store.js';

(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  /* ----- UI mount ----- */
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Nieuwe lessenreeks', icon: '📦', back: './' });
    }
    init();
  });

  /* ----- helpers (tijd/datum) ----- */
  const pad = n => String(n).padStart(2, '0');

  function parseYMD(ymd) {
    // "2025-11-30" -> Date in lokale TZ (00:00)
    const [y, m, d] = (ymd || '').split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  function addDays(d, n) {
    const x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }
async function loadClassesFromGoogle() {
  const url = window.SUPERHOND_DATA?.CLASSES_URL;
  if (!url) return [];

  const r = await fetch(url, { cache: 'no-store' });
  const j = await r.json();
  const arr = Array.isArray(j.klassen) ? j.klassen : [];

  // normaliseer naar intern model
  return arr.map(k => ({
    id: String(k.id ?? k.ID ?? k.Naam ?? ''),
    naam: String(k.Naam ?? k.naam ?? '').trim(),
    type: String(k.Type ?? k.type ?? '').trim(),
    thema: String(k.Thema ?? k.thema ?? '').trim(),
    strippen: Number(k.Strippen ?? k.strippen ?? 0) || 0,
    geldigheid_weken: Number(k['Geldigheid (weken)'] ?? k.geldigheid_weken ?? k.geldigheid ?? 0) || 0,
    status: String(k.Status ?? k.status ?? '').trim().toLowerCase(),
  }));
}

async function populateClassSelect(){
  const sel = document.querySelector('#selKlas');
  if (!sel) return;

  const all = (await loadClassesFromGoogle())
    .filter(k => k.status === 'actief')
    .sort((a,b) => a.naam.localeCompare(b.naam));

  sel.innerHTML = '<option value="">— Kies een klas —</option>';
  for (const k of all){
    const opt = document.createElement('option');
    const parts = [k.type, k.thema].filter(Boolean).join(' · ');
    opt.value = k.id || k.naam;
    opt.textContent = parts ? `${k.naam} (${parts})` : k.naam;
    opt.dataset.type  = k.type;
    opt.dataset.thema = k.thema;
    opt.dataset.strip = String(k.strippen);
    opt.dataset.weken = String(k.geldigheid_weken);
    sel.appendChild(opt);
  }
  sel.disabled = all.length === 0;
}
  function combineISO(d, hhmm) {
    // Date + "HH:MM" -> "YYYY-MM-DDTHH:MM:00"
    const [H = '00', M = '00'] = String(hhmm || '').split(':');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(H)}:${pad(M)}:00`;
  }

  function addMinutesToHHmm(hhmm, minutes) {
    const [h = 0, m = 0] = String(hhmm || '0:0').split(':').map(Number);
    const tot = h * 60 + m + Number(minutes || 0);
    const H = Math.floor((((tot % 1440) + 1440) % 1440) / 60);
    const M = ((tot % 60) + 60) % 60;
    return `${pad(H)}:${pad(M)}`;
  }

  /* ----- data fetch (extern json + local bucket) ----- */
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

  function normalizeClasses(raw) {
    const arr =
      Array.isArray(raw) ? raw :
      Array.isArray(raw?.klassen) ? raw.klassen :
      Array.isArray(raw?.classes) ? raw.classes :
      Array.isArray(raw?.items)   ? raw.items :
      Array.isArray(raw?.data)    ? raw.data  : [];

    return arr.map(k => ({
      id: k.id ?? k.classId ?? k.klasId ?? null,
      naam: S(k.naam || k.name || ''),
      type: S(k.type || ''),
      thema: S(k.thema || k.theme || ''),
      strippen: Number(k.strippen ?? k.aantal_strips ?? 0) || 0,
      geldigheid_weken: Number(k.geldigheid_weken ?? k.geldigheid ?? 0) || 0,
      status: S(k.status || 'actief').toLowerCase(),
    })).filter(k => k.id || k.naam);
  }

  const keyOf = x => S(x.id) || S(x.naam);
  function merge(primary = [], secondary = []) {
    // lokal eerst, extern overschrijft
    const map = new Map(secondary.map(x => [keyOf(x), x]));
    for (const p of primary) map.set(keyOf(p), p);
    return [...map.values()];
  }

  /* ----- init UI ----- */
  async function init() {
    try {
      ensureMigrated();

      // 1) Klassen inladen (extern + lokaal bucket)
      const extRaw = await fetchJson([
        '../data/klassen.json',
        '/data/klassen.json',
        '../data/classes.json',
        '/data/classes.json'
      ]);
      const ext = normalizeClasses(extRaw);
      const loc = normalizeClasses({ classes: getKlassen() });
      const all = merge(ext, loc)
        .filter(k => isActiefStatus(k.status)) // exact actieve klassen
        .sort((a, b) => S(a.naam).localeCompare(S(b.naam)));

      const sel = $('#selKlas');
      if (sel) {
        sel.innerHTML = '<option value="">— Kies een klas —</option>';
        for (const k of all) {
          const parts = [k.type, k.thema].filter(Boolean).join(' · ');
          const opt = document.createElement('option');
          opt.value = S(k.id || k.naam);
          opt.textContent = parts ? `${k.naam} (${parts})` : k.naam;
          opt.dataset.type  = k.type;
          opt.dataset.thema = k.thema;
          opt.dataset.strip = String(k.strippen || 0);
          opt.dataset.weken = String(k.geldigheid_weken || 0);
          sel.appendChild(opt);
        }
        sel.disabled = all.length === 0;
        bindAutofill(sel);
      }

      // 2) Knoppen
      $('#btnPreview')?.addEventListener('click', (e) => {
        e.preventDefault();
        renderPreview();
      });
      $('#formReeks')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveReeksAndLessons();
      });
    } catch (err) {
      console.error('Init mislukt:', err);
      alert('Kon de pagina niet initialiseren. Herlaad even (F5).');
    }
  }

  /* ----- autofill bij keuze klas ----- */
  function bindAutofill(sel) {
    sel.addEventListener('change', () => {
      const o = sel.selectedOptions?.[0]; if (!o) return;
      const setIfEmpty = (el, val) => { if (el && !S(el.value)) el.value = val; };

      setIfEmpty($('#type'),  o.dataset.type  || '');
      setIfEmpty($('#thema'), o.dataset.thema || '');
      if ($('#strippen'))   $('#strippen').value   = Number(o.dataset.strip || 0);
      if ($('#geldigheid')) $('#geldigheid').value = Number(o.dataset.weken || 0);
      setIfEmpty($('#pakNaam'), o.textContent.replace(/ \(.+\)$/, ''));
    });
  }

  /* ----- preview generator ----- */
  function collectForm() {
    return {
      pakNaam:   S($('#pakNaam')?.value),
      reeksNaam: S($('#reeksNaam')?.value),
      prijs:     Number($('#prijs')?.value || 0),

      startDatum: S($('#startDatum')?.value),
      startTijd:  S($('#startTijd')?.value || '09:00'),
      duurMin:    Number($('#duur')?.value || 60),
      aantal:     Number($('#aantal')?.value || 1),
      interval:   Number($('#interval')?.value || 7),

      trainers: S($('#trainers')?.value).split(',').map(s => S(s)).filter(Boolean),
      locNaam:  S($('#locNaam')?.value),
      locMaps:  S($('#locMaps')?.value),

      // ingevuld via klas (mag overschreven worden)
      type:       S($('#type')?.value),
      thema:      S($('#thema')?.value),
      strippen:   Number($('#strippen')?.value || 0),
      geldigheid: Number($('#geldigheid')?.value || 0),
      klasId:     S($('#selKlas')?.value),
    };
  }

  function buildLessons(model) {
    const out = [];
    if (!model.startDatum || !model.aantal) return out;

    const base = parseYMD(model.startDatum);
    // Interval 0 of <0 -> veilige fallback 7 dagen (voorkomt tientallen identieke lessen op één dag)
    const stepDays = model.interval > 0 ? model.interval : 7;

    for (let i = 0; i < model.aantal; i++) {
      const d = (i === 0) ? base : addDays(base, i * stepDays);
      const startISO = combineISO(d, model.startTijd);
      const eindTijd = addMinutesToHHmm(model.startTijd, model.duurMin || 60);
      const endISO   = combineISO(d, eindTijd);
      out.push({
        id: `les_${Date.now()}_${i}`,
        title: `${model.pakNaam} — ${model.reeksNaam}`,
        startISO, endISO,
        location: model.locNaam ? { name: model.locNaam, mapsUrl: model.locMaps || '' } : null,
        trainers: model.trainers || [],
      });
    }
    return out;
  }

  function renderPreview() {
    const m = collectForm();
    const list = buildLessons(m);
    const ol = $('#previewList');
    const det = $('#previewWrap');
    if (!ol || !det) return;

    if (!list.length) {
      ol.innerHTML = '<li class="muted">Niets te tonen (controleer startdatum/aantal).</li>';
      det.open = true;
      return;
    }

    const D2 = ['zo','ma','di','wo','do','vr','za'];
    const rows = list.map((l, idx) => {
      const d = new Date(l.startISO);
      const p2 = n => String(n).padStart(2, '0');
      const datum = `${D2[d.getDay()]} ${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
      const t1 = l.startISO.slice(11, 16);
      const t2 = l.endISO.slice(11, 16);
      return `<li>${idx + 1}. ${datum} ${t1}–${t2} — ${m.pakNaam} — ${m.reeksNaam}</li>`;
    }).join('');

    ol.innerHTML = rows;
    det.open = true;
  }

  /* ----- opslaan reeks + lessen ----- */
  function saveReeksAndLessons() {
    const m = collectForm();

    // basisvalidatie
    if (!m.pakNaam || !m.reeksNaam || !m.startDatum) {
      alert('Vul pakket-naam, reeks-naam en start-datum in.');
      return;
    }

    try {
      // 1) reeks record
      const seriesId = `reeks_${(crypto?.randomUUID?.() || Date.now())}`;
      const reeks = {
        id: seriesId,
        name: `${m.pakNaam} — ${m.reeksNaam}`,
        thema: m.thema,
        type: m.type,
        strippen: m.strippen,
        geldigheid_weken: m.geldigheid,
        prijs_excl: m.prijs || 0,
        status: 'actief',
        startISO: combineISO(parseYMD(m.startDatum), m.startTijd),
        endISO: null,
        locatie: m.locNaam ? { name: m.locNaam, mapsUrl: m.locMaps || '' } : null,
        trainers: m.trainers || [],
        klasId: m.klasId || null,
        recurrence: {
          startTime: m.startTijd,
          durationMin: m.duurMin,
          intervalDays: (m.interval > 0 ? m.interval : 7),
          count: m.aantal
        }
      };

      // 2) lessen genereren
      const lessons = buildLessons(m).map(x => ({ ...x, seriesId }));

      // 3) schrijven (lokale buckets)
      const reeksen = getReeksen(); reeksen.push(reeks); setReeksen(reeksen);
      const cur = getLessen(); setLessen(cur.concat(lessons));

      alert('Lessenreeks en lessen opgeslagen.');
      location.href = './';
    } catch (err) {
      console.error('Opslaan mislukt:', err);
      alert('Opslaan is mislukt. Probeer opnieuw.');
    }
  }
})();
