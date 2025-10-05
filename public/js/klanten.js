/* v0.19.0 – Klantenlijst via Google Apps Script API (i.p.v. /data/*.json) */
(() => {
  // 👇 jouw Apps Script Web-App URL (/exec)
  const API_BASE = "https://script.google.com/macros/s/AKfycbzZP5jnYyjzOzrXaZfg1KL5UMqBFXVfIyyC14YYsyCaVbREPdAQPm_cxVvagM-0nP3cWg/exec";

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

  const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // --- API helpers ---
  async function apiGet(mode, params = {}) {
    const usp = new URLSearchParams({ mode, t: Date.now(), ...params });
    const res = await fetch(`${API_BASE}?${usp.toString()}`, { method: 'GET' });
    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let j;
    try { j = JSON.parse(txt); } catch { throw new Error('Geen geldige JSON ontvangen (check ?mode)'); }
    if (!j.ok) throw new Error(j.error || 'Onbekende fout');
    return j.data; // ← array uit de Sheet
  }

  // --- Normalisatie van kolomnamen uit de Sheet naar UI-model ---
  function normKlant(k) {
    // In Sheet hebben we 'naam', 'email', 'adres'...
    const full = String(k.naam || '').trim();
    const [voornaam, ...rest] = full.split(/\s+/);
    const achternaam = rest.join(' ');
    // 'plaats' proberen uit 'adres' te halen (alles na eerste komma), of leeg laten
    let plaats = '';
    if (k.adres) {
      const parts = String(k.adres).split(',');
      plaats = (parts[1] || parts[0] || '').trim();
    }
    return {
      id: k.id || '',
      voornaam,
      achternaam,
      email: k.email || '',
      plaats,
      land: k.land || '',         // bestaat waarschijnlijk niet in Sheet → blijft leeg
      // overige velden die jouw UI niet gebruikt laten we met rust
    };
  }

  function normHond(h) {
    return {
      id: h.id || '',
      eigenaarId: h.eigenaar_id || h.eigenaarId || '',
      naam: h.naam || '',
      ras: h.ras || '',
      chip: h.chip || '',
      geboortedatum: h.geboortedatum || ''
    };
  }

  async function loadKlanten() {
    showLoader(true);
    try {
      // Haal rechtstreeks uit Apps Script i.p.v. /data/*.json
      const [klantenRaw, hondenRaw] = await Promise.all([
        apiGet('klanten'),
        apiGet('honden')
      ]);

      const klanten = klantenRaw.map(normKlant);
      const honden = hondenRaw.map(normHond);

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
      const full = `${k.voornaam || ''} ${k.achternaam || ''}`.trim().toLowerCase();
      const matchQ = !q || full.includes(q) || (k.email || '').toLowerCase().includes(q);
      const matchLand = !land || land === 'ALL' || (k.land || '') === land;
      const countDogs = (state.hondenByOwner.get(k.id) || []).length;
      const matchDogs = countDogs >= minDogs;
      return matchQ && matchLand && matchDogs;
    });
  }

  function render() {
    const rows = applyFilters([...state.klanten]); // shallow copy is genoeg
    els.tblBody.innerHTML = rows.map(k => {
      const dogs = state.hondenByOwner.get(k.id) || [];
      const dogChips = dogs.length
        ? dogs.map(d => `<a class="chip btn btn-xs" href="/honden/detail.html?id=${d.id}" title="Bekijk ${d.naam}">${d.naam}</a>`).join(' ')
        : '<span class="muted">0</span>';
      const name = `${k.voornaam || ''} ${k.achternaam || ''}`.trim();
      return `
        <tr>
          <td><a href="/klanten/detail.html?id=${k.id}"><strong>${name || '(naam onbekend)'}</strong></a></td>
          <td><a href="mailto:${k.email || ''}">${k.email || ''}</a></td>
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

  function showLoader(yes) { if (els.loader) els.loader.hidden = !yes; }
  function showError(msg) { if (els.error) { els.error.textContent = msg; els.error.hidden = false; } }

  els.q?.addEventListener('input', debounce(render, 300));
  els.land?.addEventListener('change', render);
  els.minDogs?.addEventListener('input', render);

  loadKlanten();
})();
