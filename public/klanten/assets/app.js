/* Superhond Klantenportaal – Frontend zonder backend.
   - Klantgegevens + Honden beheer (localStorage)
   - Lessen bekijken/filteren, interesse bewaren
   - Aanmelden voor les: hondselectie uit eigen lijst
   - Versie + build in footer
*/
(() => {
  // ---------- Config ----------
  const PORTAAL_VERSION = "V1.2";
  const BUILD_DATE = "23-09-2025";

  // ---------- Demo data (vervang later door API) ----------
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

  // ---------- State ----------
  const $ = (sel, el=document) => el.querySelector(sel);
  const key = {
    client: "sh_client",
    dogs: "sh_dogs",
    interest: "sh_interest"
  };
  const state = {
    client: load(key.client) || {},
    dogs: load(key.dogs) || [],
    interest: new Set(load(key.interest) || []),
    filters: { q:"", type:"", loc:"", trainer:"" }
  };

  // ---------- Elements ----------
  const tableWrap = $("#tableWrap");
  const tableTpl = $("#tableTemplate");
  const rowTpl = $("#rowTemplate");
  const cardTpl = $("#cardTemplate");
  const interestDrawer = $("#interesseDrawer");
  const interestPills = $("#interestPills");
  const dogsList = $("#dogsList");
  const dogDialog = $("#dogDialog");
  const dogForm = $("#dogForm");
  const clientForm = $("#clientForm");

  // Footer + header labels
  document.title = `Superhond – Klantenportaal ${PORTAAL_VERSION}`;
  $(".chip").textContent = `Klantenportaal · ${PORTAAL_VERSION}`;
  $(".footer").textContent = `© Superhond · Klantenportaal · ${PORTAAL_VERSION} · Gebouwd op ${BUILD_DATE}`;

  // ---------- Init ----------
  function init(){
    // Prefill client form from state
    fillClientForm(state.client);
    renderDogs();
    renderLessons();

    // Client form handlers
    clientForm.addEventListener("submit", e=>{
      e.preventDefault();
      const data = formToObj(clientForm);
      state.client = data;
      save(key.client, data);
      flash("Klantgegevens bewaard.");
    });
    $("#prefillDemo").addEventListener("click", ()=>{
      const demo = {
        firstName:"Sara", lastName:"De Smet", email:"sara@example.be",
        phone:"+32 470 00 00 00", country:"België", street:"Kleine Baan", streetNo:"12",
        zip:"2400", city:"Mol", notes:"Houdt van zaterdagen 9u."
      };
      fillClientForm(demo);
      state.client = demo; save(key.client, demo);
      if(state.dogs.length===0){
        state.dogs = [
          {id:uuid(), name:"Boef", breed:"Labrador", dob:"2023-06-01", sex:"Reu", chip:"BE1234", notes:"Vriendelijk"},
          {id:uuid(), name:"Mila", breed:"Border Collie", dob:"2021-11-20", sex:"Teef", chip:"BE9876", notes:"Energie!"}
        ];
        save(key.dogs, state.dogs); renderDogs();
      }
      flash("Demo ingevuld.");
    });
    $("#resetClient").addEventListener("click", ()=>{
      clientForm.reset(); state.client = {}; save(key.client, state.client);
      flash("Klantgegevens gereset.");
    });

    // Dogs handlers
    $("#addDogBtn").addEventListener("click", ()=> openDogDialog());
    dogDialog.addEventListener("close", ()=>{
      if(dogDialog.returnValue!=="save") return;
      const form = new FormData(dogForm);
      const dog = Object.fromEntries(form.entries());
      // nieuw of edit?
      const editId = dogForm.dataset.editId;
      if(editId){
        const idx = state.dogs.findIndex(d=>d.id===editId);
        state.dogs[idx] = {...state.dogs[idx], ...dog};
        delete dogForm.dataset.editId;
      } else {
        dog.id = uuid();
        state.dogs.push(dog);
      }
      save(key.dogs, state.dogs);
      renderDogs();
      flash("Hond opgeslagen.");
      dogForm.reset();
    });

    // Filters (lessen)
    $("#search").addEventListener("input", ({target}) => {state.filters.q = target.value; renderLessons();});
    $("#typeFilter").addEventListener("change", ({target}) => {state.filters.type = target.value; renderLessons();});
    $("#locFilter").addEventListener("change", ({target}) => {state.filters.loc = target.value; renderLessons();});
    $("#trainerFilter").addEventListener("change", ({target}) => {state.filters.trainer = target.value; renderLessons();});
    $("#resetBtn").addEventListener("click", ()=>{
      state.filters = {q:"",type:"",loc:"",trainer:""};
      $("#search").value=""; $("#typeFilter").value=""; $("#locFilter").value=""; $("#trainerFilter").value="";
      renderLessons();
    });

    // Quick link to profile section
    $("#openProfile").addEventListener("click", ()=>{
      window.scrollTo({top:0, behavior:"smooth"});
    });
  }

  // ---------- Render klant + honden ----------
  function renderDogs(){
    dogsList.innerHTML = "";
    if(state.dogs.length===0){
      dogsList.innerHTML = `<li class="empty">Nog geen honden toegevoegd.</li>`;
      return;
    }
    state.dogs.forEach(d=>{
      const li = document.createElement("li");
      li.className = "dogs-item";
      li.innerHTML = `
        <div class="info">
          <strong>${escapeHtml(d.name || "—")}</strong>
          <span class="badge">${escapeHtml(d.breed || "Onbekend ras")}</span>
          ${d.sex ? `<span class="badge">${escapeHtml(d.sex)}</span>`:""}
          ${d.dob ? `<span class="badge">${formatDate(d.dob)}</span>`:""}
          ${d.chip ? `<span class="badge">Chip: ${escapeHtml(d.chip)}</span>`:""}
          ${d.notes ? `<div class="muted">${escapeHtml(d.notes)}</div>`:""}
        </div>
        <div class="row-actions">
          <button class="btn" data-act="edit">✎ Bewerken</button>
          <button class="btn danger" data-act="del">🗑 Verwijderen</button>
        </div>
      `;
      li.querySelector('[data-act="edit"]').addEventListener("click", ()=> openDogDialog(d));
      li.querySelector('[data-act="del"]').addEventListener("click", ()=>{
        if(confirm(`Verwijder hond "${d.name}"?`)){
          state.dogs = state.dogs.filter(x=>x.id!==d.id);
          save(key.dogs, state.dogs); renderDogs();
        }
      });
      dogsList.appendChild(li);
    });
  }

  function openDogDialog(dog){
    dogForm.reset();
    if(dog){
      dogForm.name.value = dog.name || "";
      dogForm.breed.value = dog.breed || "";
      dogForm.dob.value = dog.dob || "";
      dogForm.sex.value = dog.sex || "";
      dogForm.chip.value = dog.chip || "";
      dogForm.notes.value = dog.notes || "";
      dogForm.dataset.editId = dog.id;
    }
    dogDialog.showModal();
  }

  function fillClientForm(c={}){
    clientForm.firstName.value = c.firstName || "";
    clientForm.lastName.value = c.lastName || "";
    clientForm.email.value = c.email || "";
    clientForm.phone.value = c.phone || "";
    clientForm.country.value = c.country || "";
    clientForm.street.value = c.street || "";
    clientForm.streetNo.value = c.streetNo || "";
    clientForm.zip.value = c.zip || "";
    clientForm.city.value = c.city || "";
    clientForm.notes.value = c.notes || "";
  }

  // ---------- Render lessen ----------
  function renderLessons(){
    const list = applyFilters(LESSONS, state.filters);
    tableWrap.innerHTML = "";
    if(list.length===0){
      tableWrap.innerHTML = `<div class="empty">Geen lessen gevonden met deze filters.</div>`;
      return;
    }
    const isMobile = matchMedia("(max-width: 860px)").matches;
    if(!isMobile){
      const table = tableTpl.content.cloneNode(true);
      const tb = table.querySelector("tbody");
      list.forEach(lesson => tb.appendChild(renderRow(lesson)));
      tableWrap.appendChild(table);
    } else {
      list.forEach(lesson => tableWrap.appendChild(renderCard(lesson)));
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
    if(ids.length===0){ interestDrawer.hidden = true; interestPills.innerHTML=""; return; }
    interestDrawer.hidden = false;
    interestPills.innerHTML = "";
    ids.map(id => LESSONS.find(l=>l.id===id)).forEach(lesson=>{
      const pill = document.createElement("span");
      pill.className="pill";
      pill.innerHTML = `<strong>${lesson.type}</strong> · ${formatDate(lesson.date)} · ${lesson.start}`;
      const x = document.createElement("button");
      x.setAttribute("aria-label","Verwijder interesse");
      x.textContent="✕";
      x.addEventListener("click", ()=>{ toggleInterest(lesson.id); renderLessons(); });
      pill.appendChild(x);
      interestPills.appendChild(pill);
    });
  }

  function toggleInterest(id){
    if(state.interest.has(id)) state.interest.delete(id);
    else state.interest.add(id);
    save(key.interest, [...state.interest]);
  }

  // ---------- Signup flow: kies hond ----------
  function signupFlow(lesson){
    if(!state.client.email){
      flash("Vul eerst je klantgegevens (e-mail) in bij 'Mijn gegevens'.");
      window.scrollTo({top:0, behavior:"smooth"});
      return;
    }
    if(state.dogs.length===0){
      flash("Voeg eerst een hond toe bij 'Mijn honden'.");
      window.scrollTo({top:0, behavior:"smooth"});
      return;
    }
    const picked = promptSelectDog(state.dogs);
    if(!picked) return;

    // Hier zou je een echte POST doen naar backend
    // fetch('/api/inschrijvingen', { method:'POST', headers:{'Content-Type':'application/json'},
    //   body: JSON.stringify({ client:state.client, dogId:picked.id, lesId:lesson.id }) });

    flash(`✅ Inschrijving geregistreerd voor ${picked.name} – ${lesson.type} (${formatDate(lesson.date)} ${lesson.start}).`, 4500);
  }

  function promptSelectDog(dogs){
    // Simpel chooser met prompt; kan later modal worden
    const label = dogs.map((d,i)=> `${i+1}) ${d.name} (${d.breed || "ras onbekend"})`).join("\n");
    const ans = prompt(`Welke hond inschrijven?\n${label}\nGeef het nummer (1–${dogs.length}):`, "1");
    const idx = parseInt(ans, 10) - 1;
    if(Number.isNaN(idx) || idx<0 || idx>=dogs.length) return null;
    return dogs[idx];
  }

  // ---------- Utilities ----------
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
  function formToObj(form){
    const fd = new FormData(form);
    return Object.fromEntries(fd.entries());
  }
  function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  function load(k){ try{return JSON.parse(localStorage.getItem(k));}catch{ return null; } }
  function uuid(){ return (crypto.randomUUID ? crypto.randomUUID() : 'id-'+Math.random().toString(36).slice(2)); }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }

  // ---------- Mount ----------
  init();
})();
