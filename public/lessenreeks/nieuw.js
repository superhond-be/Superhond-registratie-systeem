// /klassen/nieuw.js
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? "").trim();

  document.addEventListener("DOMContentLoaded", () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: "Nieuwe klas", icon: "📚", back: "./" });
    }
  });

  // ---- storage helpers ----
  function loadDB() {
    try {
      const raw = localStorage.getItem("superhond-db");
      const db = raw ? JSON.parse(raw) : {};
      db.classes = Array.isArray(db.classes) ? db.classes : [];
      return db;
    } catch {
      return { classes: [] };
    }
  }

  function saveDBSafe(nextDb) {
    try {
      localStorage.setItem("superhond-db", JSON.stringify(nextDb));
      return true;
    } catch (e) {
      console.error("Opslaan mislukt:", e);
      // Eenvoudige herstelpoging: verwijder evt. tijdelijke/schaduwvelden
      // (laat staan als je die ooit toevoegt)
      try {
        const slim = { ...nextDb, cache: undefined, tmp: undefined };
        localStorage.setItem("superhond-db", JSON.stringify(slim));
        return true;
      } catch (e2) {
        console.error("Tweede poging mislukt:", e2);
        alert("⚠️ Opslaan mislukt: opslag is mogelijk vol. Verwijder oude data of gebruik een export.");
        return false;
      }
    }
  }

  // ---- form ----
  const form = document.getElementById("formNieuw");
  const btnSave = form?.querySelector('button[type="submit"]');

  // voorkeurswaarden zodat duur/nummers echt getal zijn (geen lege string)
  const fld = {
    naam:        $("#naam"),
    type:        $("#type"),
    thema:       $("#thema"),
    strippen:    $("#strippen"),
    geldigheid:  $("#geldigheid"),
    status:      $("#status"),
    afbeelding:  $("#afbeelding"),
    beschrijving:$("#beschrijving"),
  };

  function buildRecord() {
    return {
      id: "klas-" + Math.random().toString(36).slice(2, 8),
      naam: S(fld.naam.value),
      type: S(fld.type.value),
      thema: S(fld.thema.value),
      strippen: Number(fld.strippen.value || 0),
      geldigheid_weken: Number(fld.geldigheid.value || 0),
      status: S(fld.status.value || "actief"),
      afbeelding: S(fld.afbeelding.value),
      beschrijving: S(fld.beschrijving.value),
      // plaats voor toekomstige velden: mailBlue, meta, etc.
    };
  }

  // blokkering tegen dubbele submit
  let submitting = false;

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (submitting) return;
    submitting = true;
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.textContent = "Bewaren…";
    }

    // minimale validatie
    if (!S(fld.naam.value)) {
      alert("Naam is verplicht.");
      submitting = false;
      if (btnSave) { btnSave.disabled = false; btnSave.textContent = "Opslaan"; }
      return;
    }

    const db = loadDB();
    const rec = buildRecord();

    // optioneel: dubbele naam binnen actieve klassen waarschuwen
    const dup = db.classes.find(k => S(k.naam).toLowerCase() === rec.naam.toLowerCase());
    if (dup && !confirm("Er bestaat al een klas met dezelfde naam. Toch opslaan?")) {
      submitting = false;
      if (btnSave) { btnSave.disabled = false; btnSave.textContent = "Opslaan"; }
      return;
    }

    db.classes.push(rec);

    const ok = saveDBSafe(db);
    if (!ok) {
      submitting = false;
      if (btnSave) { btnSave.disabled = false; btnSave.textContent = "Opslaan"; }
      return;
    }

    // kleine confirm + redirect
    alert("Klas opgeslagen.");
    location.href = "./"; // terug naar klassen-overzicht
  });

  // zorg dat nummer-velden echt nummer zijn bij start (vermijdt lege string → NaN)
  document.addEventListener("DOMContentLoaded", () => {
    if (fld.strippen && !fld.strippen.value) fld.strippen.value = "0";
    if (fld.geldigheid && !fld.geldigheid.value) fld.geldigheid.value = "0";
  });
})();
