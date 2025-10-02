// Detail van één klas
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  function bust(){ return '?t=' + Date.now(); }
  async function fetchJson(tryUrls){
    for (const u of tryUrls){
      try{
        const r = await fetch(u + bust(), {cache:'no-store'});
        if (r.ok) return r.json();
      }catch(_){}
    }
    return null;
  }

  function normalize(raw){
    if (!raw) return [];
    const arr =
      Array.isArray(raw) ? raw :
      Array.isArray(raw.klassen) ? raw.klassen :
      Array.isArray(raw.items) ? raw.items : [];
    return arr.map(k => ({
      id: k.id,
      naam: S(k.naam),
      type: S(k.type),
      thema: S(k.thema),
      strippen: Number(k.strippen ?? 0),
      geldigheid: Number(k.geldigheid_weken ?? 0),
      afbeelding: S(k.afbeelding || ''),
      beschrijving: S(k.beschrijving || ''),
      mailblue: S(k.mailblue || ''),
      status: S(k.status ?? 'actief')
    }));
  }

  function renderDetail(r){
    return `
      <h2 style="margin-top:0">${S(r.naam)}</h2>
      <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px">
        <div><strong>Type:</strong> ${S(r.type)}</div>
        <div><strong>Thema:</strong> ${S(r.thema)}</div>
        <div><strong>Aantal strippen:</strong> ${r.strippen}</div>
        <div><strong>Geldigheid:</strong> ${r.geldigheid} weken</div>
        <div><strong>Status:</strong> ${S(r.status)}</div>
        <div><strong>MailBlue:</strong> ${S(r.mailblue) || '—'}</div>
        <div><strong>Beschrijving:</strong> ${S(r.beschrijving) || '—'}</div>
        <div><strong>Afbeelding:</strong> 
          ${r.afbeelding ? `<img src="${S(r.afbeelding)}" alt="${S(r.naam)}" style="max-width:100%;height:auto"/>` : '—'}
        </div>
      </div>
    `;
  }

  async function init(){
    const params = new URLSearchParams(location.search);
    const id = params.get('id');

    const info = $('#info');
    const msg = $('#msg');

    const raw = await fetchJson(['../data/klassen.json','/data/klassen.json']);
    const rows = normalize(raw);

    const rec = rows.find(k => String(k.id) === String(id));

    if (!rec){
      msg.style.display = '';
      msg.className = 'card error';
      msg.textContent = `Klas met id ${id} niet gevonden.`;
      info.innerHTML = '';
      return;
    }

    msg.style.display = 'none';
    info.innerHTML = renderDetail(rec);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
