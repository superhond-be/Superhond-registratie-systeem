// /js/agenda.js — tabs + API→/data fallback, afgestemd op index.html
(function(){
  const tabs  = document.querySelectorAll('#agenda-tabs .tab');
  const tbody = document.querySelector('#agenda-table tbody');
  const wrap  = document.getElementById('agenda-table-wrap');
  const errEl = document.getElementById('agenda-error');

  const bust = `?t=${Date.now()}`;
  let items = [];

  const S = v => String(v ?? "");
  const toDate = d => (d ? new Date(d) : null);

  function sameWeek(d){
    if (!d) return false;
    const now = new Date();
    const start = new Date(now);
    const day = (now.getDay() + 6) % 7; // 0=ma
    start.setDate(now.getDate() - day);
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return d >= start && d < end;
  }

  function setActive(name){
    tabs.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === name)));
  }

  function rowHtml(it){
    const d = S(it.datum || "");
    const type = S(it.type || "les");
    let url = "#";
    if (type === "les") url = `/lessen/detail.html?id=${it.id}`;
    else if (type === "reeks") url = `/lessenreeks/detail.html?id=${it.id}`;
    else if (type === "mededeling") url = `/mededelingen/detail.html?id=${it.id}`;

    return `
      <tr>
        <td>${d}</td>
        <td><a href="${url}">${S(it.naam || it.titel || "(zonder titel)")}</a></td>
        <td>${type}</td>
      </tr>`;
  }

  function render(kind="week"){
    let list = items.slice();

    if (kind === "week") {
      list = list.filter(x => sameWeek(toDate(x.datum)));
    } else if (kind === "mededelingen") {
      list = list.filter(x => (x.type || "les") === "mededeling");
    }

    list.sort((a,b) => S(a.datum).localeCompare(S(b.datum)));

    // auto naar "alles" als week leeg is
    if (kind === "week" && list.length === 0) {
      setActive("alles");
      return render("alles");
    }

    tbody.innerHTML = list.length ? list.map(rowHtml).join("")
      : `<tr><td colspan="3"><em>Geen items</em></td></tr>`;

    wrap.hidden = false;
    errEl.style.display = "none";
  }

  async function loadAgenda(){
    // 1) API
    try{
      const r = await fetch('/api/agenda' + bust, { cache:'no-store' });
      if (!r.ok) throw new Error('API agenda → HTTP ' + r.status);
      return await r.json();
    }catch(e){
      // 2) static demo
      const r2 = await fetch('/data/agenda.json' + bust, { cache:'no-store' });
      if (!r2.ok) throw new Error('/data/agenda.json → HTTP ' + r2.status);
      return await r2.json();
    }
  }

  // Init
  (async () => {
    try{
      items = await loadAgenda();
      setActive('week');
      render('week');
    }catch(e){
      wrap.hidden = true;
      errEl.style.display = 'block';
      errEl.textContent = '⚠️ Agenda kon niet laden: ' + e.message;
    }
  })();

  // Tab events
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      setActive(btn.dataset.tab);
      render(btn.dataset.tab);
    });
  });

  // Watchdog: als er na 3s geen rijen zijn en geen fout, toon hint
  setTimeout(() => {
    if (wrap.hidden && errEl.style.display !== 'block') {
      errEl.style.display = 'block';
      errEl.textContent = '⚠️ Geen agenda zichtbaar. Controleer of /data/agenda.json bestaat en correcte datums bevat.';
    }
  }, 3000);
})();
