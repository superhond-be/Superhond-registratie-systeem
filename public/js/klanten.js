/* v0.18.7 static – Klantenlijst */
(() => {
  const els = {
    tblBody: document.querySelector('#klanten-tbody'),
    loader: document.querySelector('#klanten-loader'),
    error: document.querySelector('#klanten-error'),
    q: document.querySelector('#q'),
    land: document.querySelector('#land'),
    minDogs: document.querySelector('#minDogs'),
    count: document.querySelector('#count-badge')
  };

  const state = { klanten: [], hondenByOwner: new Map() };

  const debounce = (fn, ms=300) => {
    let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
  };

  async function loadKlanten() {
    showLoader(true);
    try {
      const [klRes, hoRes] = await Promise.all([
        fetch('/data/klanten.json', {cache: 'no-store'}),
        fetch('/data/honden.json', {cache: 'no-store'})
      ]);
      if (!klRes.ok || !hoRes.ok) throw new Error('Kon data niet laden');

      const [klanten, honden] = await Promise.all([klRes.json(), hoRes.json()]);
      // bouw index honden per eigenaar
      const map = new Map();
      honden.forEach(h => {
        if (!map.has(h.eigenaarId)) map.set(h.eigenaarId, []);
        map.get(h.eigenaarId).push(h);
      });
      state.klanten = klanten;
      state.hondenByOwner = map;

      render();
      showLoader(false);
    } catch (err) {
      showLoader(false);
      showError('Fout bij laden van klanten. Probeer te verversen.');
      console.error(err);
    }
  }

  function applyFilters(rows) {
    const q = (els.q.value || '').trim().toLowerCase();
    const land = els.land.value;
    const minDogs = parseInt(els.minDogs.value || '0', 10);

    return rows.filter(k => {
      const full = `${k.voornaam} ${k.achternaam}`.toLowerCase();
      const matchQ = !q || full.includes(q) || (k.email||'').toLowerCase().includes(q);
      const matchLand = !land || land === 'ALL' || k.land === land;
      const countDogs = (state.hondenByOwner.get(k.id) || []).length;
      const matchDogs = countDogs >= minDogs;
      return matchQ && matchLand && matchDogs;
    });
  }

  function render() {
    const rows = applyFilters(structuredClone(state.klanten));
    els.tblBody.innerHTML = rows.map(k => {
      const dogs = state.hondenByOwner.get(k.id) || [];
      const dogCount = dogs.length;
      const name = `${k.voornaam} ${k.achternaam}`;
      return `
        <tr>
          <td><strong>${name}</strong></td>
          <td><a href="mailto:${k.email}">${k.email}</a></td>
          <td>${k.plaats || ''}</td>
          <td>${dogCount}</td>
          <td>
            <button class="btn btn-xs" title="Bekijken" data-action="view" data-id="${k.id}">👁️</button>
            <button class="btn btn-xs" title="Bewerken" data-action="edit" data-id="${k.id}">✏️</button>
            <button class="btn btn-xs" title="Verwijderen" data-action="del" data-id="${k.id}">🗑️</button>
          </td>
        </tr>`;
    }).join('');
    els.count.textContent = `${rows.length} klanten`;
  }

  function showLoader(yes){
    els.loader.hidden = !yes;
  }
  function showError(msg){
    els.error.textContent = msg;
    els.error.hidden = false;
  }

  // events
  els.q.addEventListener('input', debounce(render, 300));
  els.land.addEventListener('change', render);
  els.minDogs.addEventListener('input', render);

  // init
  loadKlanten();
})();
