// Nieuwe klas aanmaken -> opslaan in localStorage ('superhond-db'.classes)
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  // UI mount
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Nieuwe klas', icon: '📚', back: './' });
    }
  });

  function loadDB(){
    try{
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      db.classes = Array.isArray(db.classes) ? db.classes : [];   // ← klassen lokaal
      return db;
    }catch{
      return { classes: [] };
    }
  }
  function saveDB(db){
    localStorage.setItem('superhond-db', JSON.stringify(db));
  }
  function makeId(){
    return 'klass-' + Math.random().toString(36).slice(2,8);
  }

  function validateNumber(inputEl, fallback = 0){
    const n = Number(inputEl.value);
    if (Number.isFinite(n) && n >= 0) return n;
    inputEl.value = String(fallback);
    return fallback;
  }

  function payloadFromForm(form){
    const naam   = S($('#naam').value);
    const type   = S($('#type').value);
    const thema  = S($('#thema').value);
    const strip  = validateNumber($('#strippen'), 0);
    const weken  = validateNumber($('#geldigheid'), 0);
    const img    = S($('#afbeelding').value);
    const mail   = S($('#mailblue').value);
    const status = S($('#status').value || 'actief');
    const beschr = S($('#beschrijving').value);

    if (!naam) throw new Error('Naam is verplicht');

    return {
      id: makeId(),
      naam, type, thema,
      strippen: strip,
      geldigheid_weken: weken,
      afbeelding: img,
      mailblue: mail,
      beschrijving: beschr,
      status
    };
  }

  async function onSubmit(e){
    e.preventDefault();
    const form = e.currentTarget;

    try{
      const rec = payloadFromForm(form);
      const db  = loadDB();

      // bewaren (vooraan)
      db.classes.unshift(rec);
      saveDB(db);

      // doorsturen naar klassen-overzicht (of detail)
      location.href = './'; // of: `./detail.html?id=${encodeURIComponent(rec.id)}`
    }catch(err){
      alert(err.message || err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('#formKlas')?.addEventListener('submit', onSubmit);
  });
})();
