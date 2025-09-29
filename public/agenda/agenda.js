// Agenda met API→fallback /data/agenda.json + tabs
(function () {
  const tabs = document.querySelectorAll(".tab[data-tab]");
  const tbody = document.querySelector("#agenda-table tbody");
  const wrap  = document.getElementById("agenda-table-wrap");
  const elErr = document.getElementById("agenda-error");
  const elLoad= document.getElementById("agenda-loader");

  const bust = `?t=${Date.now()}`;
  let items = [];  // alle agenda-items (les, reeks, mededeling)

  // ---- helpers ----
  const S = v => String(v ?? "");
  const toDate = d => d ? new Date(d) : null;
  const isSameWeek = (d) => {
    if (!d) return false;
    const now = new Date();
    const start = new Date(now); // maandag 00:00
    const day = (now.getDay() + 6) % 7; // 0=ma
    start.setDate(now.getDate() - day);
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return d >= start && d < end;
  };

  function rowHtml(it) {
    const type = it.type || "les";
    let url = "#";
    if (type === "les") url = `/lessen/detail.html?id=${it.id}`;
    else if (type === "reeks") url = `/lessenreeks/detail.html?id=${it.id}`;
    else if (type === "mededeling") url = `/mededelingen/detail.html?id=${it.id}`;

    return `
      <tr>
        <td><a href="${url}">${S(it.naam)}</a></td>
        <td>${S(it.datum || "")}</td>
        <td>${S(it.locatie || "")}</td>
      </tr>`;
  }

  function render(kind = "week") {
    let list = items.slice();

    if (kind === "week") {
      list = list.filter(x => isSameWeek(toDate(x.datum)));
    } else if (kind === "mededelingen") {
      list = list.filter(x => (x.type || "les") === "mededeling");
    }
    list.sort((a,b) => S(a.datum).localeCompare(S(b.datum)));

    tbody.innerHTML = list.map(rowHtml).join("") || `
      <tr><td colspan="3"><em>Geen items</em></td></tr>
    `;
    elLoad.style.display = "none";
    wrap.style.display = "";
  }

  async function loadAgenda() {
    // 1) probeer API
    try {
      const r = await fetch("/api/agenda" + bust, { cache: "no-store" });
      if (!r.ok) throw new Error("API agenda niet OK");
      return await r.json();
    } catch {
      // 2) fallback naar static demo
      const r2 = await fetch("/data/agenda.json" + bust, { cache: "no-store" });
      return await r2.json();
    }
  }

  function setActive(tabName) {
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tabName));
  }

  // ---- init ----
  (async () => {
    try {
      items = await loadAgenda();
      setActive("week");
      render("week");
    } catch (e) {
      elLoad.style.display = "none";
      elErr.style.display = "block";
      elErr.textContent = "⚠️ Kon agenda niet laden: " + e.message;
    }
  })();

  // tab handlers
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      setActive(btn.dataset.tab);
      render(btn.dataset.tab);
    });
  });
})();
