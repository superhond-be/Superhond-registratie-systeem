// Agenda — API→/data fallback, duidelijke fouten, tabs
(function () {
  const tabs  = document.querySelectorAll("#agenda-tabs .tab");
  const table = document.getElementById("agenda-table");
  const tbody = table?.querySelector("tbody");
  const wrap  = document.getElementById("agenda-table-wrap");
  const elErr = document.getElementById("agenda-error");
  const elLoad= document.getElementById("agenda-loader");

  const showError = (msg) => {
    if (elLoad) elLoad.style.display = "none";
    if (wrap)   wrap.style.display = "none";
    if (elErr) { elErr.style.display = "block"; elErr.textContent = "⚠️ " + msg; }
  };

  if (!table || !tbody || !wrap || !elErr || !elLoad) {
    return showError("Agenda lay-out ontbreekt (IDs kloppen niet).");
  }

  const bust = `?t=${Date.now()}`;
  let items = [];

  const S = v => String(v ?? "");
  const toDate = d => d ? new Date(d) : null;
  const sameWeek = (d) => {
    if (!d) return false;
    const now = new Date();
    const start = new Date(now);
    const day = (now.getDay() + 6) % 7; // 0=ma
    start.setDate(now.getDate() - day);
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return d >= start && d < end;
  };

  function setActive(name){
    tabs.forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  }

  function rowHtml(it){
    const type = it.type || "les";
    let url = "#";
    if (type === "les") url = `/lessen/detail.html?id=${it.id}`;
    else if (type === "reeks") url = `/lessenreeks/detail.html?id=${it.id}`;
    else if (type === "mededeling") url = `/mededelingen/detail.html?id=${it.id}`;

    return `
      <tr>
        <td><a href="${url}">${S(it.naam || it.titel || "(zonder titel)")}</a></td>
        <td>${S(it.datum || "")}</td>
        <td>${S(it.locatie || "")}</td>
      </tr>`;
  }

  function render(kind="week"){
    let list = items.slice();
    if (kind === "week") list = list.filter(x => sameWeek(toDate(x.datum)));
    else if (kind === "mededelingen") list = list.filter(x => (x.type || "les") === "mededeling");
    list.sort((a,b) => S(a.datum).localeCompare(S(b.datum)));

    if (kind === "week" && list.length === 0) { setActive("alles"); return render("alles"); }

    tbody.innerHTML = list.length ? list.map(rowHtml).join("")
      : `<tr><td colspan="3"><em>Geen items</em></td></tr>`;

    elLoad.style.display = "none";
    wrap.style.display = "";
    elErr.style.display = "none";
  }

  async function fetchJson(u){
    const r = await fetch(u + bust, { cache: "no-store" });
    if (!r.ok) throw new Error(`${u} → HTTP ${r.status}`);
    return r.json();
  }

  async function loadAgenda(){
    const candidates = ["/api/agenda", "/data/agenda.json"];
    const errors = [];
    for (const u of candidates) {
      try { return await fetchJson(u); }
      catch (e) { errors.push(e.message); }
    }
    throw new Error(errors.join(" | "));
  }

  (async () => {
    try {
      items = await loadAgenda();
      if (!Array.isArray(items)) throw new Error("Agenda-data is geen array.");
      setActive("week");
      render("week");
    } catch (e) {
      showError("Kon agenda niet laden. " + e.message);
      // Toon lege tabel zodat de lay-out duidelijk is
      wrap.style.display = "";
      tbody.innerHTML = `<tr><td colspan="3"><em>Geen agenda zichtbaar</em></td></tr>`;
    }
  })();

  tabs.forEach(btn => {
    btn.addEventListener("click", () => { setActive(btn.dataset.tab); render(btn.dataset.tab); });
  });

  // Watchdog: na 3s nog steeds loader? Toon hint.
  setTimeout(() => {
    if (elLoad.style.display !== "none") {
      showError("Geen reactie van agenda. Klopt het pad naar /js/agenda.js en bestaat /data/agenda.json?");
    }
  }, 3000);
})();
