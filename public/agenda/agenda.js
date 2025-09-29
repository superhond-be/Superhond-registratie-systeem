// Agenda met API→fallback /data/agenda.json + tabs + auto-fallback naar "alles" + robuuste paden + debug
(function () {
  const tabs  = document.querySelectorAll(".tab[data-tab]");
  const table = document.getElementById("agenda-table");
  const tbody = table?.querySelector("tbody");
  const wrap  = document.getElementById("agenda-table-wrap");
  const elErr = document.getElementById("agenda-error");
  const elLoad= document.getElementById("agenda-loader");

  // --- DOM sanity check ---
  if (!table || !tbody || !wrap) {
    console.error("Agenda: ontbrekende DOM (#agenda-table / #agenda-table-wrap).");
    if (elErr) { elErr.style.display = "block"; elErr.textContent = "Agenda lay-out ontbreekt (tabel/wrapper)."; }
    return;
  }

  const bust = `?t=${Date.now()}`;
  let items = [];

  // --- helpers ---
  const S = v => String(v ?? "");
  const toDate = d => (d ? new Date(d) : null);
  const isSameWeek = (d) => {
    if (!d) return false;
    // week = maandag 00:00 → maandag 00:00
    const now = new Date();
    const start = new Date(now);
    const day = (now.getDay() + 6) % 7; // 0 = maandag
    start.setDate(now.getDate() - day);
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return d >= start && d < end;
  };

  function rowHtml(it) {
    const type = it.type || "les";
    let url = "#";
    if (type === "les")          url = `/lessen/detail.html?id=${it.id}`;
    else if (type === "reeks")   url = `/lessenreeks/detail.html?id=${it.id}`;
    else if (type === "mededeling") url = `/mededelingen/detail.html?id=${it.id}`;

    return `
      <tr>
        <td><a href="${url}">${S(it.naam)}</a></td>
        <td>${S(it.datum || "")}</td>
        <td>${S(it.locatie || "")}</td>
      </tr>`;
  }

  function setActive(tabName) {
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tabName));
  }

  function render(kind = "week") {
    let list = items.slice();

    if (kind === "week") {
      list = list.filter(x => isSameWeek(toDate(x.datum)));
    } else if (kind === "mededelingen") {
      list = list.filter(x => (x.type || "les") === "mededeling");
    }

    list.sort((a,b) => S(a.datum).localeCompare(S(b.datum)));

    // auto-fallback naar "alles" als week leeg is
    if (kind === "week" && list.length === 0) {
      setActive("alles");
      return render("alles");
    }

    tbody.innerHTML = list.length
      ? list.map(rowHtml).join("")
      : `<tr><td colspan="3"><em>Geen items</em></td></tr>`;

    elLoad.style.display = "none";
    wrap.style.display = ""; // altijd tonen, ook bij "geen items"
  }

  async function fetchJson(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
    return r.json();
  }

  async function loadAgenda() {
    const candidates = [
      "/api/agenda",               // API (als je server draait)
      "/data/agenda.json",         // absolute root
      "../data/agenda.json",       // als dashboard in /dashboard/ staat
      "./data/agenda.json"         // fallback wanneer alles in één map draait
    ];
    const tried = [];
    for (const u of candidates) {
      try {
        const data = await fetchJson(u + bust);
        console.log("[agenda] geladen uit:", u, "items:", Array.isArray(data) ? data.length : "n/a");
        return data;
      } catch (e) {
        tried.push(e.message);
        continue;
      }
    }
    throw new Error("Geen agenda-bron bereikbaar. Probeer één van:\n" + tried.join("\n"));
  }

  (async () => {
    try {
      items = await loadAgenda();

      // Basic validatie & hint
      if (!Array.isArray(items)) throw new Error("Agenda-data is geen array.");
      if (!items.length) console.warn("Agenda: lege lijst. Voeg demo toe in /data/agenda.json.");

      // Start op week; render() schakelt zelf naar 'alles' indien nodig
      setActive("week");
      render("week");
    } catch (e) {
      console.error(e);
      elLoad.style.display = "none";
      elErr.style.display = "block";
      elErr.textContent = "⚠️ Kon agenda niet laden: " + e.message;
      // Toon alsnog lege tabel zodat je de layout ziet
      wrap.style.display = "";
      tbody.innerHTML = `<tr><td colspan="3"><em>Kon agenda niet laden</em></td></tr>`;
    }
  })();

  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      setActive(btn.dataset.tab);
      render(btn.dataset.tab);
    });
  });
})();
