// /public/js/klanten.js
(function () {
  const form = document.getElementById('klantForm');
  const out  = document.getElementById('resultBox');
  const prefillBtn = document.getElementById('prefillBtn');

  function serializeForm(fd) {
    const obj = {};
    for (const [k, v] of fd.entries()) obj[k] = v.trim();
    // eenvoudige normalisaties
    if (obj.email) obj.email = obj.email.toLowerCase();
    return obj;
  }

  function show(json) {
    out.textContent = JSON.stringify(json, null, 2);
  }

  prefillBtn?.addEventListener('click', () => {
    const demo = {
      voornaam: "An",
      achternaam: "Peeters",
      email: "an.peeters@example.com",
      telefoon: "+32 470 12 34 56",
      land: "België",
      straat: "Dorpsstraat",
      nr: "7",
      toevoeging: "bus 2",
      postcode: "2470",
      plaats: "Retie",
      opmerkingen: "Interesse puppy-lessen. Beschikbaar woe/za."
    };
    Object.entries(demo).forEach(([k, v]) => {
      const el = form.querySelector(`[name="${k}"]`);
      if (!el) return;
      if (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.value = v;
      }
    });
    show({ mode: "prefill", klant: demo });
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = serializeForm(new FormData(form));

    // simpele validatie
    if (!data.voornaam || !data.achternaam || !data.email) {
      show({ error: "Gelieve voornaam, achternaam en e-mail in te vullen." });
      return;
    }

    // DEMO: toon lokaal
    show({ mode: "demo-save", klant: data, timestamp: new Date().toISOString() });

    // ✅ Klaar voor backend — later omschakelen naar echte API:
    /*
    try {
      const res = await fetch('/api/klanten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('API error');
      const saved = await res.json();
      show({ mode: "saved", klant: saved });
      form.reset();
    } catch (err) {
      show({ error: "Opslaan mislukt", details: String(err) });
    }
    */
  });
})();
