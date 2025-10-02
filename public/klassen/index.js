// Klassen – overzicht
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  const els = {
    loader: $('#loader'),
    error: $('#error'),
    wrap: $('#wrap'),
    tbody: document.querySelector('#tabel tbody'),
    zoek: $('#zoek')
  };

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
      status: S(k.status ?? 'actief')
    }));
  }

  function rowHTML(r){
    return `
      <tr data-id="${S(r.id)}">
        <td><a href="./detail.html?id=${encodeURIComponent(r.id)}">${S(r.naam)}</a></td>
        <td>${S(r.type)}</td>
        <td>${S(r.thema)}</td>
        <td>${r.strippen}</td>
        <td>${r.geldigheid} weken</td>
        <td>${r.status}</td>
        <td>
          <a href="./detail.html?id=${encodeURIComponent(r.id)}" class="btn btn-xs">Bekijken</a>
          <a href="./bewerken.html?id=${encodeURIComponent(r.id)}" class="btn btn-xs">Bewerken</a>
          <button data-action="delete" data-id="${S(r.id)}" class="btn btn-xs">Verwijderen</button>
        </td>
      </tr>
    `;
  }

  function render(rows){
    els.tbody.innerHTML = rows.map(rowHTML).join('');
    els.wrap.style.display = rows.length ? '' : 'none';
  }

  async function init(){
    try{
      els.loader.style.display = '';
      const raw = await fetchJson(['../data/klassen.json','/data/klassen.json']);
      const rows = normalize(raw).sort((a,b)=>a.naam.localeCompare(b.naam));
      render(rows);
      els.loader.style.display = 'none';
    }catch(e){
      els.loader.style.display = 'none';
      els.error.style.display = '';
      els.error.textContent = '⚠️ Kon klassen niet laden';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
