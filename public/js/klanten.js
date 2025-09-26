// /public/js/klanten.js






// Voeg bovenaan bij het laden toe:
const [resKlanten, resHonden] = await Promise.all([
  fetch('/data/klanten.json?b=' + Date.now()),
  fetch('/data/honden.json?b=' + Date.now())
]);
const [klanten, honden] = await Promise.all([resKlanten.json(), resHonden.json()]);

// Maak een teller: klantId -> aantal honden
const hondenPerKlant = honden.reduce((acc, h) => {
  acc[h.klantId] = (acc[h.klantId] || 0) + 1;
  return acc;
}, {});

// …en in je tabel-weergave per klant:
const count = hondenPerKlant[k.id] || 0;
// toon `count` in de kolom “Honden”

(function () {
  const TBL = document.querySelector('#klantenTable tbody');
  const zoekInput = document.getElementById('zoekInput');
  const minDogs   = document.getElementById('minDogs');
  const landFilter= document.getElementById('landFilter');
  const form      = document.getElementById('klantForm');
  const out       = document.getElementById('resultBox');
  const prefillBtn= document.getElementById('prefillBtn');

  let KLANTEN = [];
  let HONDEN  = [];

  // --- helpers ---
  const toKey = (k) => k.voornaam + ' ' + k.achternaam;
  const countDogs = (klantId) => HONDEN.filter(h => h.klantId === klantId).length;

  function show(json){ out.textContent = JSON.stringify(json, null, 2); }

  // filters
  function filterData() {
    const zoek = (zoekInput.value || '').toLowerCase();
    const min  = parseInt(minDogs.value || '0', 10);
    const land = landFilter ? landFilter.value : '';

    return KLANTEN.filter(k => {
      const dogs = countDogs(k.id);
      const matchZoek =
        toKey(k).toLowerCase().includes(zoek) ||
        (k.email || '').toLowerCase().includes(zoek);
      const matchDogs = dogs >= min;
      const matchLand = !land || k.land === land;
      return matchZoek && matchDogs && matchLand;
    });
  }

  // render
  function renderTable() {
    if (!TBL) return;
    const data = filterData();
    TBL.innerHTML = data.map(k => {
      const dogs = countDogs(k.id);
      const naam = `${k.voornaam} ${k.achternaam}`;
      const plaats = [k.postcode, k.plaats].filter(Boolean).join(' ');
      return `
        <tr>
          <td>${naam}<div class="sub">${k.land}</div></td>
          <td>${k.email || ''}</td>
          <td>${plaats}</td>
          <td style="text-align:center">${dogs}</td>
          <td>
            <button class="btn btn-small" data-edit="${k.id}">✏️ Bewerken</button>
            <button class="btn btn-small" data-del="${k.id}">🗑️ Verwijderen</button>
          </td>
        </tr>`;
    }).join('') || `<tr><td colspan="5" style="text-align:center;color:#888">Geen resultaten…</td></tr>`;
  }

  // events
  [zoekInput, minDogs, landFilter].forEach(el => el && el.addEventListener('input', renderTable));

  // demo prefill
  prefillBtn?.addEventListener('click', () => {
    const demo = {
      voornaam: "An", achternaam: "Peeters", email: "an.peeters@example.com",
      telefoon: "+32 470 12 34 56", land: "België",
      straat: "Dorpsstraat", nr: "7", toevoeging: "bus 2",
      postcode: "2470", plaats: "Retie",
      opmerkingen: "Interesse puppy-lessen. Beschikbaar woe/za."
    };
    Object.entries(demo).forEach(([k,v])=>{
      const el = form.querySelector(`[name="${k}"]`); if (el) el.value = v;
    });
    show({mode:"prefill", klant:demo});
  });

  // submit (demo)
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const obj = {}; fd.forEach((v,k)=>obj[k]=String(v||'').trim());
    if (!obj.voornaam || !obj.achternaam || !obj.email) {
      show({error:"Gelieve voornaam, achternaam en e-mail in te vullen."});
      return;
    }
    show({mode:"demo-save", klant:obj, ts:new Date().toISOString()});

    // Later: echte POST /api/klanten
    // const res = await fetch('/api/klanten',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)})
  });

  // --- data laden (LET OP: absolute paden vanaf /) ---
  async function loadData() {
    // Omdat we op /klanten/ zitten, gebruiken we absolute paden:
    // /data/klanten.json en /data/honden.json
    const [kRes, hRes] = await Promise.all([
      fetch('/data/klanten.json?b=' + Date.now()),
      fetch('/data/honden.json?b=' + Date.now())
    ]);
    KLANTEN = await kRes.json();
    HONDEN  = await hRes.json();
  }

  (async function init(){
    try {
      await loadData();
    } catch (e) {
      show({error:"Kon demo-data niet laden", details:String(e)});
      KLANTEN = []; HONDEN = [];
    }
    renderTable();
  })();
})();
