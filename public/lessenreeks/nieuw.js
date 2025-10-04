// Nieuwe lessenreeks – snelle klassen-lader (Sheets met fallback) + autofill + veilig opslaan

import {
  ensureMigrated,
  getKlassen,
  getReeksen,
  setReeksen,
  getLessen,
  setLessen,
  isActiefStatus,
} from '../js/store.js';

import { fetchSheet, normStatus } from '../js/sheets.js';

(() => {
  /* ---------------- util ---------------- */
  const $  = s => document.querySelector(s);
  const S  = v => String(v ?? '').trim();
  const pad = n => String(n).padStart(2, '0');

  const ui = {
    hint:  () => $('#classesHint'),
    error: () => $('#classesError'),
    setHint(msg){ const el = this.hint(); if (el){ el.textContent = msg; el.style.display = ''; } },
    setError(msg){ const el = this.error(); if (el){ el.textContent = msg; el.style.display = msg ? '' : 'none'; } }
  };

  /* ---------------- mount ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Nieuwe lessenreeks', icon: '📦', back: './' });
    }
    init();
  });

  /* ---------------- datum/tijd helpers ---------------- */
  function parseYMD(ymd){
    const [y,m,d] = (ymd || '').split('-').map(Number);
    return new Date(y, (m||1)-1, d||1);
  }
  function addDays(d, n){ const x = new Date(d.getTime()); x.setDate(x.getDate()+n); return x; }
  function combineISO(d, hhmm){
    const [H='00', M='00'] = String(hhmm||'').split(':');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(H)}:${pad(M)}:00`;
  }
  function addMinutesToHHmm(hhmm, minutes){
    const [h=0,m=0] = String(hhmm||'0:0').split(':').map(Number);
    const tot = h*60 + m + Number(minutes||0);
    const H = Math.floor((((tot%1440)+1440)%1440)/60);
    const M = ((tot%60)+60)%60;
    return `${pad(H)}:${pad(M)}`;
  }

  /* ---------------- externe JSON fallback ---------------- */
  async function fetchJson(tryUrls){
    for (const u of tryUrls){
      try{
        const url = u + (u.includes('?') ? '&' : '?') + 't=' + Date.now();
        const r = await fetch(url, { cache:'no-store' });
        if (r.ok) return r.json();
      }catch(_){/* noop */}
    }
    return null;
  }
  function normalizeClasses(raw){
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
  function merge(primary=[], secondary=[]){
    // lokale/secondary eerst, primary (extern) overschrijft
    const map = new Map(secondary.map(x => [keyOf(x), x]));
    for (const p of primary) map.set(keyOf(p), p);
    return [...map.values()];
  }

  /* ---------------- klassen laden (Sheets → fallback) ---------------- */
  async function loadClasses(){
    // 1) Google Sheets (primair)
    try{
      const rows = await fetchSheet('Klassen');
      const viaSheets = rows.map(k => ({
        id: S(k.id || k.ID || k.klasId || ''),
        naam: S(k.naam || k.Naam || k.name || ''),
        type: S(k.type || k.Type || ''),
        thema: S(k.thema || k.Thema || ''),
        strippen: Number(k.strippen ?? k.Strippen ?? 0) || 0,
        geldigheid_weken: Number(k.geldigheid_weken ?? k['Geldigheid (weken)'] ?? 0) || 0,
        status: normStatus(k.status),
      }));
      return viaSheets
        .filter(k => (k.id || k.naam) && k.status === 'actief')
        .sort((a,b) => a.naam.localeCompare(b.naam));
    }catch(_){/* val terug op JSON + local */ }

    // 2) Fallback: statische JSON + lokale bucket
    const extRaw = await fetchJson([
      '../data/klassen.json','/data/klassen.json',
      '../data/classes.json','/data/classes.json'
    ]);
    const ext = normalizeClasses(extRaw);
    const loc = normalizeClasses({ classes: getKlassen() });
    return merge(ext, loc)
      .filter(k => isActiefStatus(k.status))
      .sort((a,b) => a.naam.localeCompare(b.naam));
  }

  /* ---------------- init UI ---------------- */
  async function init(){
    ensureMigrated();

    const sel = $('#selKlas');
    if (sel){
      ui.setHint('Klassen laden…'); ui.setError('');
      try{
        const classes = await loadClasses();
        sel.innerHTML = '<option value="">— Kies een klas —</option>';
        for (const k of classes){
          const parts = [k.type, k.thema].filter(Boolean).join(' · ');
          const o = document.createElement('option');
          o.value = S(k.id || k.naam);
          o.textContent = parts ? `${k.naam} (${parts})` : k.naam;
          o.dataset.type  = k.type;
          o.dataset.thema = k.thema;
          o.dataset.strip = String(k.strippen);
          o.dataset.weken = String(k.geldigheid_weken);
          sel.appendChild(o);
        }
        sel.disabled = classes.length === 0;
        ui.setHint(classes.length ? `${classes.length} klas(sen) gevonden.` : 'Geen actieve klassen gevonden.');
        bindAutofill(sel);
      }catch(err){
        console.error('Klassen laden faalde:', err);
        ui.setError('Kon klassen niet laden. Controleer verbinding of Sheets-config.');
        sel.innerHTML = '<option value="">— Geen klassen —</option>';
        sel.disabled = true;
      }
    }

    // Knoppen
    $('#btnPreview')?.addEventListener('click', e => { e.preventDefault(); renderPreview(); });
    $('#formReeks')?.addEventListener('submit',  onSubmitSave);
  }

  /* ---------------- autofill ---------------- */
  function bindAutofill(sel){
    sel.addEventListener('change', () => {
      const o = sel.selectedOptions?.[0]; if (!o) return;
      const setIfEmpty = (el,val) => { if (el && !S(el.value)) el.value = val; };

      setIfEmpty($('#type'),  o.dataset.type  || '');
      setIfEmpty($('#thema'), o.dataset.thema || '');
      if ($('#strippen'))   $('#strippen').value   = Number(o.dataset.strip || 0);
      if ($('#geldigheid')) $('#geldigheid').value = Number(o.dataset.weken || 0);
      setIfEmpty($('#pakNaam'), o.textContent.replace(/ \(.+\)$/, ''));
    });
  }

  /* ---------------- preview ---------------- */
  function collectForm(){
    return {
      pakNaam:   S($('#pakNaam')?.value),
      reeksNaam: S($('#reeksNaam')?.value),
      prijs:     Number($('#prijs')?.value || 0),

      startDatum: S($('#startDatum')?.value),
      startTijd:  S($('#startTijd')?.value || '09:00'),
      duurMin:    Number($('#duur')?.value || 60),
      aantal:     Number($('#aantal')?.value || 1),
      interval:   Number($('#interval')?.value || 7),

      trainers: S($('#trainers')?.value).split(',').map(S).filter(Boolean),
      locNaam:  S($('#locNaam')?.value),
      locMaps:  S($('#locMaps')?.value),

      // uit klas
      type:       S($('#type')?.value),
      thema:      S($('#thema')?.value),
      strippen:   Number($('#strippen')?.value || 0),
      geldigheid: Number($('#geldigheid')?.value || 0),
      klasId:     S($('#selKlas')?.value),
    };
  }

  function buildLessons(m){
    const out = [];
    if (!m.startDatum || !m.aantal) return out;

    const base = parseYMD(m.startDatum);
    const stepDays = m.interval > 0 ? m.interval : 7;

    for (let i=0;i<m.aantal;i++){
      const d = (i===0) ? base : addDays(base, i*stepDays);
      const startISO = combineISO(d, m.startTijd);
      const eindTijd = addMinutesToHHmm(m.startTijd, m.duurMin || 60);
      const endISO   = combineISO(d, eindTijd);
      out.push({
        id: `les_${(crypto?.randomUUID?.() || Date.now())}_${i}`,
        title: `${m.pakNaam} — ${m.reeksNaam}`,
        startISO, endISO,
        location: m.locNaam ? { name:m.locNaam, mapsUrl:m.locMaps||'' } : null,
        trainers: m.trainers || [],
      });
    }
    return out;
  }

  function renderPreview(){
    const m = collectForm();
    const list = buildLessons(m);
    const ol  = $('#previewList');
    const det = $('#previewWrap');
    if (!ol || !det) return;

    if (!list.length){
      ol.innerHTML = '<li class="muted">Niets te tonen (controleer startdatum/aantal).</li>';
      det.open = true; return;
    }

    const D2 = ['zo','ma','di','wo','do','vr','za'];
    const rows = list.map((l,idx) => {
      const d = new Date(l.startISO);
      const p2 = n => String(n).padStart(2,'0');
      const datum = `${D2[d.getDay()]} ${p2(d.getDate())}/${p2(d.getMonth()+1)}/${d.getFullYear()}`;
      const t1 = l.startISO.slice(11,16);
      const t2 = l.endISO.slice(11,16);
      return `<li>${idx+1}. ${datum} ${t1}–${t2} — ${m.pakNaam} — ${m.reeksNaam}</li>`;
    }).join('');
    ol.innerHTML = rows;
    det.open = true;
  }

  /* ---------------- opslaan ---------------- */
  function onSubmitSave(e){
    e.preventDefault();

    // dubbele submit voorkomen
    const form = $('#formReeks');
    const btns = form?.querySelectorAll('button, a.btn');
    btns?.forEach(b => b.disabled = true);

    try {
      saveReeksAndLessons();
    } finally {
      // bij redirect merk je dit niet; bij fout worden knoppen her-enaabled
      btns?.forEach(b => b.disabled = false);
    }
  }

  function saveReeksAndLessons(){
    const m = collectForm();
    if (!m.pakNaam || !m.reeksNaam || !m.startDatum){
      alert('Vul pakket-naam, reeks-naam en start-datum in.');
      return;
    }

    try{
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
        locatie: m.locNaam ? { name:m.locNaam, mapsUrl:m.locMaps||'' } : null,
        trainers: m.trainers || [],
        klasId: m.klasId || null,
        recurrence: {
          startTime: m.startTijd,
          durationMin: m.duurMin,
          intervalDays: (m.interval > 0 ? m.interval : 7),
          count: m.aantal,
        },
      };

      const lessons = buildLessons(m).map(x => ({ ...x, seriesId }));

      const reeksen = getReeksen(); reeksen.push(reeks); setReeksen(reeksen);
      const cur = getLessen(); setLessen(cur.concat(lessons));

      alert('Lessenreeks en lessen opgeslagen.');
      location.href = './';
    }catch(err){
      console.error('Opslaan mislukt:', err);
      alert('Opslaan is mislukt. Probeer opnieuw.');
    }
  }
})();
