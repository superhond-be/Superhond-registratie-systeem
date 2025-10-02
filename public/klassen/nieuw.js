// Nieuwe klas – opslaan in localStorage
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Nieuwe klas', icon: '📚', back: './' });
    }
  });

  function loadDB(){
    try{
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      db.klassen = Array.isArray(db.klassen) ? db.klassen : [];
      return db;
    }catch{ return { klassen:[] }; }
  }
  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }

  function genId(){
    return 'klass-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6);
  }

  const form = $('#formKlas');
  const msg  = $('#msg');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const naam         = S($('#naam').value);
    const type         = S($('#type').value);
    const thema        = S($('#thema').value);
    const strippen     = Number($('#strippen').value || 0);
    const geldigheid   = Number($('#geldigheid').value || 0);
    const prijs        = Number($('#prijs').value || 0);
    const status       = S($('#status').value || 'actief');
    const mailblue     = S($('#mailblue').value);
    const afbeelding   = S($('#afbeelding').value);
    const beschrijving = S($('#beschrijving').value);

    if (!naam || !strippen || !geldigheid){
      msg.textContent = 'Vul minstens Naam, Strippen en Geldigheid in.';
      msg.className = 'error';
      return;
    }

    const db = loadDB();

    // record
    const rec = {
      id: genId(),
      naam, type, thema,
      strippen,
      geldigheid_weken: geldigheid,
      prijs_excl: isNaN(prijs) ? 0 : prijs,
      status,
      mailblue,
      afbeelding,
      beschrijving,
      // datum van aanmaak (handig voor sortering)
      createdAt: new Date().toISOString()
    };

    db.klassen.push(rec);
    saveDB(db);

    msg.className = 'muted';
    msg.textContent = '✔️ Opgeslagen. Terug naar overzicht…';
    // korte delay zodat de gebruiker feedback ziet
    setTimeout(() => { location.href = './'; }, 400);
  });
})();
