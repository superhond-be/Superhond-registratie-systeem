/* Superhond Klantenportaal – Frontend zonder backend.
   - Lessen bekijken, filteren, interesse bewaren (localStorage)
   - Mock "Aanmelden" flow (kan later naar echte API)
*/
(() => {
  // ------- Demo data (vervang later door API) -------
  /** Elke les: id, type, niveau, groepCap, date, start, end, locatie{name, maps}, trainers[], tags[] */
  const LESSONS = [
    {id:"L-250925-01", type:"Basisgroep", niveau:"Gevorderd", groepCap:8, date:"2025-09-25", start:"09:30", end:"10:30",
      locatie:{name:"Dessel Park", maps:"https://maps.google.com/?q=Dessel Park"}, trainers:["Paul"], tags:["sociaal","gehoorzaamheid"]},
    {id:"L-280925-01", type:"Puppy Start", niveau:"Start", groepCap:10, date:"2025-09-28", start:"09:00", end:"10:00",
      locatie:{name:"Retie Terrein", maps:"https://maps.google.com/?q=Retie Terrein"}, trainers:["Maas"], tags:["puppy","basis"]},
    {id:"L-051025-01", type:"Puppy Start", niveau:"Start", groepCap:10, date:"2025-10-05", start:"09:00", end:"10:00",
      locatie:{name:"Retie Terrein", maps:"https://maps.google.com/?q=Retie Terrein"}, trainers:["Maas"], tags:["puppy"]},
    {id:"L-121025-01", type:"Puppy Start", niveau:"Start", groepCap:10, date:"2025-10-12", start:"09:00", end:"10:00",
      locatie:{name:"Retie Terrein", maps:"https://maps.google.com/?q=Retie Terrein"}, trainers:["Sofie"], tags:["puppy"]},
    {id:"L-191025-01", type:"Puppy Start", niveau:"Start", groepCap:10, date:"2025-10-19", start:"09:00", end:"10:00",
      locatie:{name:"Retie Terrein", maps:"https://maps.google.com/?q=Retie Terrein"}, trainers:["Maas"], tags:["puppy"]},
    {id:"L-261025-01", type:"Puppy Start", niveau:"Start", groepCap:10, date:"2025-10-26", start:"09:00", end:"10:00",
      locatie:{name:"Retie Terrein", maps:"https://maps.google.com/?q=Retie Terrein"}, trainers:["Maas"], tags:["puppy"]},
    {id:"L-091125-01", type:"Puppy Start", niveau:"Start", groepCap:10, date:"2025-11-09", start:"09:00", end:"10:00",
      locatie:{name:"Retie Terrein", maps:"https://maps.google.com/?q=Retie Terrein"}, trainers:["Maas"], tags:["puppy"]},
    {id:"L-161125-01", type:"Puppy Start", niveau:"Start", groepCap:10, date:"2025-11-16", start:"09:00", end:"10:00",
      locatie:{name:"Retie Terrein", maps:"https://maps.google.com/?q=Retie Terrein"}, trainers:["Maas"], tags:["puppy"]},
    {id:"L-011025-PRV", type:"Privé", niveau:"—", groepCap:1, date:"2025-10-01", start:"18:00", end:"18:45",
      locatie:{name:"Turnhout Hal", maps:"https://maps.google.com/?q=Turnhout"}, trainers:["Sofie"], tags:["privé","gedrag"]}
  ];

  // --------------- Helpers -------------------
  const $ = (sel, el=document) => el.querySelector(sel);
  const state = {
    clientId: localStorage.getItem("sh_clientId") || "",
    interest: new Set(JSON.parse(localStorage.getItem("sh_interest") || "[]")),
    filters: { q:"", type:"", loc:"", trainer:"" }
  };

  // --------------- Elements -------------------
  const tableWrap = $("#tableWrap");
  const tableTpl = $("#tableTemplate");
  const rowTpl = $("#rowTemplate");
  const cardTpl = $("#cardTemplate");
  const interesseDrawer = $("#interesseDrawer");
  const interestPills = $("#interestPills");

  // --------------- Init -----------------------
  function init() {
    // Topbar ID form
    $("#clientId").value = state.clientId;
    $("#idForm").addEventListener("submit", e=>{
      e.preventDefault();
      state.clientId = $("#clientId").value.trim();
      localStorage.setItem("sh_clientId", state.clientId);
      flash(`Gegevens bewaard${state.clientId ? ` voor ${state.clientId}`:""}.`);
    });

    // Filters
    $("#search").addEventListener("input", ({target}) => {state.filters.q = target.value; render();});
    $("#typeFilter").addEventListener("change", ({target}) => {state.filters.type = target.value; render();});
    $("#locFilter").addEventListener("change", ({target}) => {state.filters.loc = target.value; render();});
    $("#trainerFilter").addEventListener("change", ({target}) => {state.filters.trainer = target.value; render();});
    $("#resetBtn").addEventListener("click", resetFilters);

    render();
  }

  function resetFilters(){
    state.filters = {q:"",type:"",loc:"",trainer:""};
    $("#search").value=""; $("#typeFilter").value=""; $("#locFilter").value=""; $("#trainerFilter").value="";
    render();
  }

  // --------------- Render ---------------------
  function render(){
    const list = applyFilters(LESSONS, state.filters);
    tableWrap.innerHTML = "";
    if(list.length===0){
      tableWrap.innerHTML = `<div class="empty">Geen lessen gevonden met deze filters. Probeer minder streng te filteren.</div>`;
    } else {
      const isMobile = matchMedia("(max-width: 860px)").matches;
      if(!isMobile){
        const table = tableTpl.content.cloneNode(true);
        const tb = table.querySelector("tbody");
        list.forEach(lesson => tb.appendChild(renderRow(lesson)));
        tableWrap.appendChild(table);
      } else {
        list.forEach(lesson => tableWrap.appendChild(renderCard(lesson)));
      }
    }
    renderInterestDrawer();
  }

  function renderRow(lesson){
    const tr = rowTpl.content.cloneNode(true);
    tr.querySelector(".caps").textContent = `${lesson.type} • ${lesson.niveau} • ${lesson.groepCap} cap`;
    tr.querySelector(".date").textContent = formatDate(lesson.date);
    tr.querySelector(".time").textContent = `${lesson.start} – ${lesson.end}`;
    tr.querySelector(".loc").innerHTML = `<a href="${lesson.locatie.maps}" target="_blank" rel="noopener">${lesson.locatie.name}</a>`;
    tr.querySelector(".trainer").textContent = lesson.trainers.join(", ");
    tr.querySelector(".row-actions").append(...actionButtons(lesson));
    return tr;
  }

  function renderCard(lesson){
    const card = cardTpl.content.cloneNode(true);
    card.querySelector(".title").textContent = `${lesson.type} • ${lesson.niveau}`;
    card.querySelector(".meta").innerHTML = `
      ${formatDate(lesson.date)} • ${lesson.start}–${lesson.end}<br>
      <a href="${lesson.locatie.maps}" target="_blank" rel="noopener">${lesson.locatie.name}</a> • ${lesson.trainers.join(", ")} • cap ${lesson.groepCap}
    `;
    card.querySelector(".row-actions").append(...actionButtons(lesson));
    return card;
  }

  function actionButtons(lesson){
    const heart = document.createElement("button");
    heart.className = "btn heart";
    heart.type="button";
    heart.setAttribute("aria-pressed", state.interest.has(lesson.id) ? "true":"false");
    heart.innerHTML = (state.interest.has(lesson.id) ? "❤️" : "🤍") + " Interessant";
    heart.addEventListener("click", ()=>{
      toggleInterest(lesson.id);
      heart.setAttribute("aria-pressed", state.interest.has(lesson.id) ? "true":"false");
      heart.innerHTML = (state.interest.has(lesson.id) ? "❤️" : "🤍") + " Interessant";
      renderInterestDrawer();
    });

    const signup = document.createElement("button");
    signup.className = "btn primary";
    signup.type="button";
    signup.innerHTML = "Aanmelden";
    signup.addEventListener("click", ()=> signupFlow(lesson));

    const more = document.createElement("a");
    more.className = "btn";
    more.href = lesson.locatie.maps;
    more.target="_blank";
    more.rel="noopener";
    more.textContent = "☍ Route";
    return [heart, signup, more];
  }

  function renderInterestDrawer(){
    const ids = [...state.interest];
    if(ids.length===0){ interesseDrawer.hidden = true; interestPills.innerHTML=""; return; }
    interesseDrawer.hidden = false;
    interestPills.innerHTML = "";
    ids.map(id => LESSONS.find(l=>l.id===id)).forEach(lesson=>{
      const pill = document.createElement("span");
      pill.className="pill";
      pill.innerHTML = `<strong>${lesson.type}</strong> · ${formatDate(lesson.date)} · ${lesson.start}`;
      const x = document.createElement("button");
      x.setAttribute("aria-label","Verwijder interesse");
      x.textContent="✕";
      x.addEventListener("click", ()=>{ toggleInterest(lesson.id); render(); });
      pill.appendChild(x);
      interestPills.appendChild(pill);
    });
  }

  function toggleInterest(id){
    if(state.interest.has(id)) state.interest.delete(id);
    else state.interest.add(id);
    localStorage.setItem("sh_interest", JSON.stringify([...state.interest]));
  }

  // --------------- Signup flow (mock) ----------
  function signupFlow(lesson){
    const client = state.clientId || prompt("Jouw e-mail (nodig voor bevestiging):","");
    if(!client) return;
    state.clientId = client;
    localStorage.setItem("sh_clientId", client);

    const hond = prompt("Naam van je hond:",""); if(!hond) return;

    // Hier zou je normaal een fetch POST doen naar je backend.
    // fetch('/api/inschrijvingen', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({client, hond, lesId:lesson.id})})
    //   .then(r=>r.json()).then(()=>flash(`Inschrijving ontvangen voor ${lesson.type} op ${formatDate(lesson.date)}.`));

    flash(`✅ Inschrijving opgeslagen (lokaal) voor ${hond} – ${lesson.type} op ${formatDate(lesson.date)}.`, 4200);
    const key = "sh_signups";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push({client,hond,lesId:lesson.id,when:new Date().toISOString()});
    localStorage.setItem(key, JSON.stringify(arr));
  }

  // --------------- Utilities -------------------
  function applyFilters(list, f){
    const q = f.q.trim().toLowerCase();
    return list.filter(l=>{
      const inQ = !q || [
        l.type,l.niveau,l.locatie.name,l.trainers.join(" "), l.id, ...(l.tags||[])
      ].join(" ").toLowerCase().includes(q);
      const inType = !f.type || l.type===f.type;
      const inLoc = !f.loc || l.locatie.name===f.loc;
      const inTrainer = !f.trainer || l.trainers.includes(f.trainer);
      return inQ && inType && inLoc && inTrainer;
    }).sort((a,b)=> (a.date+a.start).localeCompare(b.date+b.start));
  }
  function formatDate(iso){
    const d = new Date(iso+"T00:00:00");
    return d.toLocaleDateString("nl-BE",{weekday:"short", day:"2-digit", month:"short", year:"numeric"});
  }
  function flash(msg, ms=2500){
    const n = document.createElement("div");
    n.textContent = msg;
    Object.assign(n.style,{
      position:"fixed",inset:"auto 1rem 1rem auto",background:"#111827",color:"#fff",
      padding:"10px 14px",borderRadius:"10px",boxShadow:"0 6px 20px rgba(0,0,0,.25)",zIndex:50,opacity:"0",transform:"translateY(6px)",
      maxWidth:"min(90vw, 460px)"
    });
    document.body.appendChild(n);
    requestAnimationFrame(()=>{ n.style.transition="all .2s"; n.style.opacity="1"; n.style.transform="translateY(0)";});
    setTimeout(()=>{ n.style.opacity="0"; n.style.transform="translateY(6px)";}, ms);
    setTimeout(()=> n.remove(), ms+220);
  }

  // ------------ Mount -----------------
  init();
})();
