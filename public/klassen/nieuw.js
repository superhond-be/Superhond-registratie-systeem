// /public/klassen/nieuw.js
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  // Topbar
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Nieuwe klas', icon:'🏷️', back:'./' });
    }
  });

  // --- Helpers ---
  function loadDB(){
    try{
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      db.classes = Array.isArray(db.classes) ? db.classes : [];   // lokale key
      return db;
    }catch{
      return { classes: [] };
    }
  }
  function saveDB(db){
    localStorage.setItem('superhond-db', JSON.stringify(db));
  }
  function genId(){
    const t = new Date();
    const pad = n => String(n).padStart(2,'0');
    const id = `klas-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
    return id;
  }
  function euro(n){
    if (n==null || isNaN(n)) return '—';
    return new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(Number(n));
  }

  // --- Preview ---
  const els = {
    form:         $('#formKlas'),
    naam:         $('#naam'),
    type:         $('#type'),
    thema:        $('#thema'),
    strippen:     $('#strippen'),
    geldigheid:   $('#geldigheid'),
    afbeelding:   $('#afbeelding'),
    beschrijving: $('#beschrijving'),
    mailblue:     $('#mailblue'),
    status:       $('#status'),
    preview:      $('#preview'),
    reset:        $('#btnReset'),
  };

  function renderPreview(){
    const naam = S(els.naam.value);
    const type = S(els.type.value);
    const thema= S(els.thema.value);
    const str  = Number(els.strippen.value || 0);
    const gd   = Number(els.geldigheid.value || 0);

    els.preview.innerHTML = `
      <ul style="margin:.3rem 0;padding-left:1.2rem">
        <li><strong>Naam:</strong> ${naam || '—'} ${type ? '— '+type : ''}</li>
        <li><strong>Thema:</strong> ${thema || '—'}</li>
        <li><strong>Strippen (klant):</strong> ${isNaN(str)?'—':str}</li>
        <li><strong>Geldigheidsduur:</strong> ${isNaN(gd)?'—':gd} weken</li>
        <li><strong>Status:</strong> ${S(els.status.value) || 'actief'}</li>
      </ul>
      <div class="muted">Beschrijving: ${S(els.beschrijving.value) || '—'}</div>
    `;
  }
  ['input','change'].forEach(ev => {
    ['naam','type','thema','strippen','geldigheid','beschrijving','status']
      .forEach(k => els[k].addEventListener(ev, renderPreview));
  });

  // --- Submit ---
  els.form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Basis validatie
    const naam = S(els.naam.value);
    const type = S(els.type.value);
    if (!naam || !type){
      alert('Vul minstens Naam en Type in.');
      return;
    }

    const rec = {
      id: genId(),
      naam,
      type,
      thema:        S(els.thema.value),
      strippen:     Number(els.strippen.value || 0),
      geldigheidsduur: Number(els.geldigheid.value || 0),
      afbeelding:   S(els.afbeelding.value),
      beschrijving: S(els.beschrijving.value),
      mailblue:     S(els.mailblue.value),
      status:       S(els.status.value || 'actief'),
      // handig voor sortering of auditing:
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const db = loadDB();
    db.classes.push(rec);
    saveDB(db);

    // bevestiging + doorsturen naar overzicht klassen
    alert('Klas opgeslagen.');
    location.href = './'; // verwacht /public/klassen/index.html
  });

  els.reset.addEventListener('click', () => {
    els.form.reset();
    renderPreview();
  });

  // Eerste render
  document.addEventListener('DOMContentLoaded', renderPreview);
})();
