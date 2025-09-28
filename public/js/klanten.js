/* v0.18.9 – Klantenlijst met join op honden + filters + click-through */
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

  const debounce = (fn, ms=300) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

  async function loadKlanten() {
    showLoader(true);
    try {
      const [klRes, hoRes] = await Promise.all([
        fetch('/data/klanten.json?b='+Date.now(), {cache: 'no-store'}),
        fetch('/data/honden.json?b='+Date.now(), {cache: 'no-store'})
      ]);
      if (!klRes.ok || !hoRes.ok) throw new Error('Kon data niet laden');

      const [klanten, honden] = await Promise.all([klRes.json(), hoRes.json()]);
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
    const q = (els.q?.value || '').trim().toLowerCase();
    const land = els.land?.value;
    const minDogs = parseInt(els.minDogs?.value || '0', 10);

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
      const dogChips = dogs.length
        ? dogs.map(d => `<a class="chip btn btn-xs" href="/honden/detail.html?id=${d.id}" title="Bekijk ${d.naam}">${d.naam}</a>`).join(' ')
        : '<span class="muted">0</span>';
      const name = `${k.voornaam} ${k.achternaam}`;
      return `
        <tr>
          <td><a href="/klanten/detail.html?id=${k.id}"><strong>${name}</strong></a></td>
          <td><a href="mailto:${k.email}">${k.email}</a></td>
          <td>${k.plaats || ''}</td>
          <td>${dogChips}</td>
          <td>
            <a class="btn btn-xs" href="/klanten/detail.html?id=${k.id}" title="Bekijken">👁️</a>
            <button class="btn btn-xs" title="Bewerken" data-action="edit" data-id="${k.id}">✏️</button>
            <button class="btn btn-xs" title="Verwijderen" data-action="del" data-id="${k.id}">🗑️</button>
          </td>
        </tr>`;
    }).join('');
    if (els.count) els.count.textContent = `${rows.length} klanten`;
  }

  function showLoader(yes){ if (els.loader) els.loader.hidden = !yes; }
  function showError(msg){ if (els.error){ els.error.textContent = msg; els.error.hidden = false; } }

  els.q?.addEventListener('input', debounce(render, 300));
  els.land?.addEventListener('change', render);
  els.minDogs?.addEventListener('input', render);

  loadKlanten();
})();
