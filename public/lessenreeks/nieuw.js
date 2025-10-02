// Nieuw strippenpakket (GEEN auto-lessen; einddatum niet berekenen)
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Strippenpakket', icon:'📦', back:'./' });
    }
  });

  // ---- storage helpers ----
  function loadDB(){
    try {
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      db.series  = Array.isArray(db.series)  ? db.series  : [];
      db.lessons = Array.isArray(db.lessons) ? db.lessons : [];
      return db;
    } catch { return { series:[], lessons:[] }; }
  }
  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }

  async function fetchJson(tryUrls){
    for (const u of tryUrls){
      try {
        const r = await fetch(u + (u.includes('?')?'':'?t=') + Date.now(), { cache:'no-store' });
        if (r.ok) return r.json();
      }catch(_){}
    }
    return null;
  }

  const D2 = ['zo','ma','di','wo','do','vr','za'];
  function dow2(dateStr){
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00');
    return D2[d.getDay()];
  }

  async function populateRefs(){
    const [trainers, locaties] = await Promise.all([
      fetchJson(['../data/trainers.json','/data/trainers.json']) || [],
      fetchJson(['../data/locaties.json','/data/locaties.json']) || []
    ]);

    const tSel = $('#trainerIds');
    tSel.innerHTML = '';
    (Array.isArray(trainers) ? trainers : trainers?.items || []).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id ?? t.code ?? S(t.naam || t.name);
      opt.textContent = t.naam || t.name || ('Trainer ' + (opt.value||''));
      tSel.appendChild(opt);
    });

    const lSel = $('#locatieId');
    lSel.innerHTML = '';
    (Array.isArray(locaties) ? locaties : locaties?.items || []).forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id ?? l.code ?? S(l.naam || l.name);
      opt.textContent = l.naam || l.name || ('Locatie ' + (opt.value||''));
      opt.dataset.maps = l.mapsUrl || l.maps || '';
      lSel.appendChild(opt);
    });
  }

  function bindDowBadges(){
    const s = $('#startDatum'), e = $('#eindDatum');
    const sDOW = $('#startDOW'), eDOW = $('#eindDOW');
    const upd = () => {
      sDOW.textContent = s.value ? dow2(s.value) : '—';
      eDOW.textContent = e.value ? dow2(e.value) : '—';
    };
    s.addEventListener('input', upd);
    e.addEventListener('input', upd);
    upd();
  }

  function bindSubmit(){
    $('#formReeks').addEventListener('submit', (ev) => {
      ev.preventDefault();

      const pkg  = S($('#pakNaam').value);
      const ser  = S($('#reeksNaam').value);
      const name = [pkg, ser].filter(Boolean).join(' — ') || pkg;

      const startISO = $('#startDatum').value ? $('#startDatum').value + 'T00:00' : null;
      const endISO   = $('#eindDatum').value  ? $('#eindDatum').value  + 'T23:59' : null;

      const locSel   = $('#locatieId');
      const locOpt   = locSel.options[locSel.selectedIndex];
      const locatie  = {
        id:   S(locSel.value || ''),
        name: S(locOpt?.textContent || ''),
        mapsUrl: S(locOpt?.dataset.maps || '')
      };

      const trainerOptions = Array.from($('#trainerIds').selectedOptions);
      const trainerIds   = trainerOptions.map(o => S(o.value));
      const trainerNamen = trainerOptions.map(o => S(o.textContent));

      const record = {
        id: 'reeks-' + Math.random().toString(36).slice(2, 8),
        name,
        thema: S($('#thema').value),
        // belangrijk: strippen i.p.v. "aantal lessen"
        strippen: Number($('#strippen').value || 0),
        geldigheid_weken: Number($('#geldigheidWeken').value || 0),
        max_deelnemers: Number($('#maxDeelnemers').value || 0),
        lesduur_min: Number($('#lesduur').value || 0),
        startISO,          // alleen weergegeven met DOW, geen auto-berekening
        endISO,            // ingevuld door gebruiker
        locatie,
        trainers: trainerNamen,      // voor weergave
        trainerIds,                  // voor logica
        prijs_excl: Number($('#prijs').value || 0),
        status: S($('#status').value || 'actief'),
        type: 'strippenpakket'
      };

      const db = loadDB();
      db.series.push(record);
      saveDB(db);

      // naar overzicht
      location.href = './';
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await populateRefs();
    bindDowBadges();
    bindSubmit();
  });
})();
