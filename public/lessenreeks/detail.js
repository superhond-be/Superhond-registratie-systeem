<!-- Plaats NIET in HTML. Dit is de volledige JS voor /public/lessenreeks/detail.js -->
<script>
/* Lessenreeks – detail: kopblok + bewerkbare/verw. lessen + “Nieuwe les” */
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();
  const D2 = ['zo','ma','di','wo','do','vr','za'];
  const pad2 = n => String(n).padStart(2,'0');

  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Lessenreeks – Detail', icon:'📦', back:'./' });
    }
  });

  function bust(u){ return u + (u.includes('?')?'&':'?') + 't=' + Date.now(); }
  async function fetchJson(tryUrls){
    for (const u of tryUrls){
      try{ const r = await fetch(bust(u), { cache:'no-store' }); if (r.ok) return r.json(); }catch(_){}
    }
    return null;
  }
  function loadDB(){
    try{
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      db.series  = Array.isArray(db.series)  ? db.series  : [];
      db.lessons = Array.isArray(db.lessons) ? db.lessons : [];
      return db;
    }catch{ return { series:[], lessons:[] }; }
  }
  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }

  function normalizeKlassen(raw){
    if (!raw) return [];
    const arr = Array.isArray(raw.klassen) ? raw.klassen :
                Array.isArray(raw.items)   ? raw.items   :
                Array.isArray(raw.data)    ? raw.data    :
                Array.isArray(raw)         ? raw         : [];
    return arr.map(k => ({
      id:k.id, naam:S(k.naam||k.name||''), thema:S(k.thema||k.theme||''),
      strippen:Number(k.aantalStrippen ?? k.strippen ?? 0)||0,
      geldigheid_weken:Number(k.geldigheidsduur_weken ?? k.weken ?? 0)||0,
      prijs_excl:Number(k.prijs_excl ?? k.price ?? 0)||0,
      lesduur_min:Number(k.lesduur_min ?? k.duur ?? 0)||0,
      status:S(k.status||'actief')
    }));
  }

  function normalizeReeksen(raw){
    if (!raw) return [];
    const arr = Array.isArray(raw.lessenreeksen) ? raw.lessenreeksen :
                Array.isArray(raw.reeksen)       ? raw.reeksen       :
                Array.isArray(raw.items)         ? raw.items         :
                Array.isArray(raw.data)          ? raw.data          :
                Array.isArray(raw)               ? raw               : [];
    return arr.map(r => ({
      id:S(r.id ?? r.reeksId ?? r.seriesId ?? ''),
      klasId:S(r.klasId ?? r.classId ?? ''),
      naam:S(r.naam || r.name || ''),
      thema:S(r.thema || r.theme || ''),
      datum:S(r.datum || r.startDatum || ''),
      begintijd:S(r.begintijd || r.startTime || ''),
      eindtijd:S(r.eindtijd  || r.endTime   || ''),
      maxDeelnemers:Number(r.maxDeelnemers ?? r.max ?? 0)||0,
      locatie:(r.locatie && typeof r.locatie==='object')
        ? { naam:S(r.locatie.naam || r.locatie.name || ''), mapsUrl:S(r.locatie.mapsUrl || '')||null }
        : { naam:S(r.locatie || r.location || ''), mapsUrl:null },
      trainers:Array.isArray(r.trainers)? r.trainers.map(S):[],
      status:S(r.status || 'actief')
    }));
  }

  function normalizeLessons(arr){
    if (!Array.isArray(arr)) return [];
    return arr.map(l => ({
      id:S(l.id),
      seriesId:S(l.seriesId || l.reeksId || ''),
      klasId:S(l.klasId || ''),
      titel:S(l.titel || l.title || l.name || 'Les'),
      startISO:S(l.startISO || l.start || ''),
      endISO:S(l.endISO || l.end || ''),
      locatie:(l.locatie && typeof l.locatie==='object')
        ? { naam:S(l.locatie.naam || l.locatie.name || ''), mapsUrl:S(l.locatie.mapsUrl || '')||null }
        : { naam:S(l.locatie || ''), mapsUrl:null },
      trainers:Array.isArray(l.trainers)? l.trainers.map(S):[],
      status:S(l.status || 'actief')
    }));
  }

  const euro = n => (n == null || isNaN(n)) ? '—' :
    new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(Number(n));

  function fmtDateTimeRange(startISO,endISO){
    if (!startISO) return '—';
    const s = new Date(String(startISO).replace(' ','T'));
    const e = endISO ? new Date(String(endISO).replace(' ','T')) : null;
    const d = `${D2[s.getDay()]} ${pad2(s.getDate())}/${pad2(s.getMonth()+1)}/${s.getFullYear()}`;
    const t1 = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
    if (e){ const t2 = `${pad2(e.getHours())}:${pad2(e.getMinutes())}`; return `${d} ${t1} — ${t2}`; }
    return `${d} ${t1}`;
  }
  function addMinutes(dateISO, minutes){
    const d = new Date(String(dateISO).replace(' ','T'));
    d.setMinutes(d.getMinutes() + Number(minutes||0));
    return d.toISOString().slice(0,16) + ':00';
  }

  async function init(){
    const params = new URLSearchParams(location.search);
    const id = params.get('id');

    const info = $('#info');
    const msg  = $('#msg');
    const body = $('#lessenBody');

    const [klasJSON, reeksJSON] = await Promise.all([
      fetchJson(['../data/klassen.json','/data/klassen.json']),
      fetchJson(['../data/lessenreeksen.json','/data/lessenreeksen.json'])
    ]);
    const KLASSEN = normalizeKlassen(klasJSON);
    const REEKSEN = normalizeReeksen(reeksJSON);

    const db = loadDB();
    const lessons = normalizeLessons(db.lessons);

    const reeks = REEKSEN.find(r => String(r.id) === String(id));
    if (!reeks){
      msg.style.display = '';
      msg.className = 'card error';
      msg.textContent = `Reeks met id ${id} niet gevonden.`;
      info.innerHTML = '';
      return;
    }
    const klas = KLASSEN.find(k => String(k.id) === String(reeks.klasId)) || null;

    // Kopblok
    info.innerHTML = `
      <h2 style="margin-top:0">${S(reeks.naam)}</h2>
      <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px">
        <div><strong>Thema:</strong> ${S(reeks.thema || klas?.thema || '—')}</div>
        <div><strong>Aantal strippen (klas):</strong> ${klas?.strippen ?? '—'}</div>
        <div><strong>Geldigheid (klas):</strong> ${klas?.geldigheid_weken ?? '—'} weken</div>
        <div><strong>Prijs (excl.):</strong> ${klas ? euro(klas.prijs_excl) : '—'}</div>
        <div><strong>Start (reeks):</strong> ${S(reeks.datum || '—')} ${reeks.begintijd ? `— ${reeks.begintijd}`:''}</div>
        <div><strong>Einde (reeks):</strong> ${S(reeks.datum || '—')} ${reeks.eindtijd ? `— ${reeks.eindtijd}`:''}</div>
        <div><strong>Max. deelnemers/les:</strong> ${reeks.maxDeelnemers || '—'}</div>
        <div><strong>Status:</strong> ${S(reeks.status)}</div>
        <div><strong>Locatie:</strong>
          ${
            reeks.locatie?.mapsUrl
              ? `<a href="${S(reeks.locatie.mapsUrl)}" target="_blank" rel="noopener">${S(reeks.locatie.naam || 'Locatie')}</a>`
              : S(reeks.locatie?.naam || '—')
          }
        </div>
        <div><strong>Trainers:</strong>
          ${(reeks.trainers||[]).length ? reeks.trainers.map(t=>`<span class="badge">${S(t)}</span>`).join(' ') : '—'}
        </div>
      </div>
    `;

    // Lessen in deze reeks
    const myLessons = lessons
      .filter(l => String(l.seriesId) === String(reeks.id))
      .sort((a,b) => S(a.startISO).localeCompare(S(b.startISO)));

    body.innerHTML = myLessons.length
      ? myLessons.map(l => `
          <tr data-id="${l.id}">
            <td>${S(l.titel)}</td>
            <td>${fmtDateTimeRange(l.startISO,l.endISO)}</td>
            <td>${l.locatie?.mapsUrl ? `<a href="${S(l.locatie.mapsUrl)}" target="_blank" rel="noopener">${S(l.locatie.naam||'Locatie')}</a>` : S(l.locatie?.naam || '—')}</td>
            <td>${(l.trainers||[]).length ? l.trainers.map(t=>`<span class="badge">${S(t)}</span>`).join(' ') : '—'}</td>
            <td style="white-space:nowrap">
              <button class="icon-btn" data-act="view" title="Bekijken"><i class="icon icon-view"></i></button>
              <button class="icon-btn" data-act="edit" title="Bewerken"><i class="icon icon-edit"></i></button>
              <button class="icon-btn" data-act="del"  title="Verwijderen"><i class="icon icon-del"></i></button>
            </td>
          </tr>
        `).join('')
      : `<tr><td colspan="5" class="muted">Geen gekoppelde lessen.</td></tr>`;

    // Acties op lessen (simpel: edit = tijd + trainers + locatie inline prompt)
    body.addEventListener('click', (e) => {
      const row = e.target.closest('tr[data-id]');
      if (!row) return;
      const id = row.getAttribute('data-id');
      const actBtn = e.target.closest('button[data-act]');
      if (!actBtn) return;
      const act = actBtn.getAttribute('data-act');

      const db2 = loadDB();
      const idx = db2.lessons.findIndex(x => String(x.id) === String(id));
      if (idx < 0) return;

      if (act === 'del') {
        if (!confirm('Les verwijderen?')) return;
        db2.lessons.splice(idx,1);
        saveDB(db2);
        row.remove();
        return;
      }

      if (act === 'edit') {
        const rec = db2.lessons[idx];
        const start = prompt('Start (YYYY-MM-DDTHH:mm)', rec.startISO || '');
        if (!start) return;
        let end = rec.endISO;
        const defaultEnd = klas?.lesduur_min ? addMinutes(start, klas.lesduur_min) : (rec.endISO || '');
        end = prompt('Eind (YYYY-MM-DDTHH:mm)', defaultEnd) || defaultEnd;

        const loc = prompt('Locatie-naam', (rec.locatie?.naam || reeks.locatie?.naam || '')) || '';
        const maps= prompt('Google Maps URL (optioneel)', (rec.locatie?.mapsUrl || reeks.locatie?.mapsUrl || '')) || '';
        const trs = prompt('Trainers (komma-gescheiden)', (rec.trainers||reeks.trainers||[]).join(', ')) || '';

        rec.startISO = start;
        rec.endISO   = end;
        rec.locatie  = { naam: loc, mapsUrl: maps || null };
        rec.trainers = trs.split(',').map(s=>S(s)).filter(Boolean);

        db2.lessons[idx] = rec;
        saveDB(db2);
        location.reload();
        return;
      }

      if (act === 'view') {
        alert('Hier kan later een detailvenster of navigatie naar /lessen/detail.html komen.');
      }
    });

    // + Nieuwe les
    const addBtn = document.createElement('p');
    addBtn.innerHTML = `<button class="btn" id="btnAdd">+ Nieuwe les</button>`;
    info.insertAdjacentElement('afterend', addBtn.firstChild);
    $('#btnAdd').addEventListener('click', () => {
      const db3 = loadDB();
      const idNew = 'les-' + Math.random().toString(36).slice(2,8);
      const date = prompt('Datum (YYYY-MM-DD)', reeks.datum || '') || reeks.datum || '';
      const startT = prompt('Starttijd (HH:mm)', reeks.begintijd || '09:00') || '09:00';
      const startISO = `${date}T${startT}`;
      const endISO = reeks.eindtijd
        ? `${date}T${reeks.eindtijd}`
        : (klas?.lesduur_min ? addMinutes(startISO, klas.lesduur_min) : `${date}T${startT}`);

      const loc = prompt('Locatie-naam', reeks.locatie?.naam || '') || (reeks.locatie?.naam || '');
      const maps= prompt('Google Maps URL (optioneel)', reeks.locatie?.mapsUrl || '') || '';
      const trs = prompt('Trainers (komma-gescheiden)', (reeks.trainers||[]).join(', ')) || '';

      const rec = {
        id: idNew,
        seriesId: reeks.id,
        klasId: reeks.klasId,
        titel: reeks.naam || 'Les',
        startISO, endISO,
        locatie: { naam: loc, mapsUrl: maps || null },
        trainers: trs.split(',').map(s=>S(s)).filter(Boolean),
        status: 'actief'
      };
      db3.lessons.push(rec);
      saveDB(db3);
      location.reload();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
</script>
