// Klas bewerken – laadt record en slaat terug naar localStorage (superhond-db.classes)
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Klas bewerken', icon:'✏️', back:'./' });
    }
  });

  const fields = {
    name:        $('#f_name'),
    type:        $('#f_type'),
    thema:       $('#f_thema'),
    strippen:    $('#f_strippen'),
    weken:       $('#f_weken'),
    status:      $('#f_status'),
    mailblue:    $('#f_mailblue'),
    afbeelding:  $('#f_afbeelding'),
    omschrijving:$('#f_omschrijving')
  };

  function loadDB(){
    try{
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      db.classes = Array.isArray(db.classes) ? db.classes : [];
      return db;
    }catch{ return { classes:[] }; }
  }
  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }

  function normalizeClasses(raw){
    const arr =
      Array.isArray(raw) ? raw :
      Array.isArray(raw?.klassen) ? raw.klassen :
      Array.isArray(raw?.classes) ? raw.classes :
      Array.isArray(raw?.items) ? raw.items :
      Array.isArray(raw?.data) ? raw.data : [];
    return arr.map(k => ({
      id: S(k.id ?? ''),
      name: S(k.name ?? k.naam ?? ''),
      type: S(k.type ?? k.subnaam ?? ''),
      thema: S(k.thema ?? k.theme ?? ''),
      strippen: Number(k.strippen ?? 0) || 0,
      weken: Number(k.weken ?? 0) || 0,
      afbeelding: S(k.afbeelding ?? ''),
      omschrijving: S(k.omschrijving ?? ''),
      mailblue: S(k.mailblue ?? ''),
      status: (S(k.status || 'actief').toLowerCase() === 'inactief') ? 'inactief' : 'actief'
    }));
  }

  async function init(){
    const id = new URLSearchParams(location.search).get('id');
    const back = $('#backLink');
    back.href = id ? `./detail.html?id=${encodeURIComponent(id)}` : './';

    const db = loadDB();
    let rec = (db.classes || []).find(c => String(c.id) === String(id));

    if (!rec) {
      // niets in localStorage – probeer eventueel te ‘seed’en uit JSON (alleen lezen)
      // maar bij bewerken is local gewenst; toon lege form als fallback
      rec = {
        id, name:'', type:'', thema:'', strippen:0, weken:0, afbeelding:'',
        omschrijving:'', mailblue:'', status:'actief'
      };
    }

    // form vullen
    fields.name.value         = rec.name || '';
    fields.type.value         = rec.type || '';
    fields.thema.value        = rec.thema || '';
    fields.strippen.value     = rec.strippen ?? 0;
    fields.weken.value        = rec.weken ?? 0;
    fields.status.value       = rec.status || 'actief';
    fields.mailblue.value     = rec.mailblue || '';
    fields.afbeelding.value   = rec.afbeelding || '';
    fields.omschrijving.value = rec.omschrijving || '';

    $('#form').addEventListener('submit', (e) => {
      e.preventDefault();

      const updated = {
        id,
        name: S(fields.name.value),
        type: S(fields.type.value),
        thema: S(fields.thema.value),
        strippen: Number(fields.strippen.value || 0),
        weken: Number(fields.weken.value || 0),
        afbeelding: S(fields.afbeelding.value),
        omschrijving: S(fields.omschrijving.value),
        mailblue: S(fields.mailblue.value),
        status: S(fields.status.value || 'actief')
      };

      const db2 = loadDB();
      const i = (db2.classes || []).findIndex(c => String(c.id) === String(id));
      if (i >= 0) db2.classes[i] = updated;
      else (db2.classes || []).push(updated);
      saveDB(db2);

      location.href = `./detail.html?id=${encodeURIComponent(id)}`;
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
