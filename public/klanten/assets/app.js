/public/klanten/assets/app.js
```js
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
  const LOCALE = "nl-BE";

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

  // ---------- Storage shim (veilig in private mode/quota) ----------
  const memStore = new Map();
  const safeStorage = {
    getItem(k){ try { return localStorage.getItem(k); } catch { return memStore.get(k) ?? null; } },
    setItem(k,v){ try { localStorage.setItem(k,v); } catch { memStore.set(k,v); } },
    removeItem(k){ try { localStorage.removeItem(k); } catch { memStore.delete(k); } },
  };

  // ---------- State ----------
  const $  = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

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

  // ---------- Elements (met guards) ----------
  const tableWrap       = $("#tableWrap");
  const tableTpl        = $("#tableTemplate");
  const rowTpl          = $("#rowTemplate");
  const cardTpl         = $("#cardTemplate");
  const interestDrawer  = $("#interesseDrawer");
  const interestPills   = $("#interestPills");
  const dogsList        = $("#dogsList");
  const dogDialog       = $("#dogDialog");
  const dogForm         = $("#dogForm");
  const clientForm      = $("#clientForm");

  // Footer + header labels (alleen als aanwezig)
  document.title = `Superhond – Klantenportaal ${PORTAAL_VERSION}`;
  const headerChip = $(".chip"); if (headerChip) headerChip.textContent = `Klantenportaal · ${PORTAAL_VERSION}`;
  const footerEl = $(".footer"); if (footerEl) footerEl.textContent = `© Superhond · Klantenportaal · ${PORTAAL_VERSION} · Gebouwd op ${BUILD_DATE}`;

  // ---------- Init ----------
  function init(){
    // Als essentiële elementen ontbreken, stop netjes
    if (!clientForm || !dogsList || !tableWrap) {
      console.warn("[app] Vereiste DOM-elementen ontbreken, initialisatie geannuleerd.");
      return;
    }

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

    const prefillDemoBtn = $("#prefillDemo");
    if (prefillDemoBtn) prefillDemoBtn.addEventListener("click", ()=>{
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

    const resetClientBtn = $("#resetClient");
    if (resetClientBtn) resetClientBtn.addEventListener("click", ()=>{
      clientForm.reset(); state.client = {}; save(key.client, state.client);
      flash("Klantgegevens gereset.");
    });

    // Dogs handlers
    const addDogBtn = $("#addDogBtn");
    if (addDogBtn && dogDialog && dogForm) {
      addDogBtn.addEventListener("click", ()=> openDogDialog());

      dogDialog.addEventListener("close", ()=>{
        if(dogDialog.returnValue!=="save") return;
        const form = new FormData(dogForm);
        const dog = Object.fromEntries(form.entries());
        // nieuw of edit?
        const editId = dogForm.dataset.editId;
        if(editId){
          const idx = state.dogs.findIndex(d=>d.id===editId);
          if (idx >= 0) state.dogs[idx] = {...state.dogs[idx], ...dog};
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
    }

    // Filters (lessen)
    const searchEl   = $("#search");
    const typeEl     = $("#typeFilter");
    const locEl      = $("#locFilter");
    const trainerEl  = $("#trainerFilter");
    const resetBtn   = $("#resetBtn");

    if (searchEl)  searchEl.addEventListener("input",  ({target}) => {state.filters.q = target.value; renderLessons();});
    if (typeEl)    typeEl.addEventListener("change", ({target}) => {state.filters.type = target.value; renderLessons();});
    if (locEl)     locEl.addEventListener("change",  ({target}) => {state.filters.loc = target.value; renderLessons();});
    if (trainerEl) trainerEl.addEventListener("change", ({target}) => {state.filters.trainer = target.value; renderLessons();});
    if (resetBtn)  resetBtn.addEventListener("click", ()=>{
      state.filters = {q:"",type:"",loc:"",trainer:""};
      if (searchEl)  searchEl.value="";
      if (typeEl)    typeEl.value="";
      if (locEl)     locEl.value="";
      if (trainerEl) trainerEl.value="";
      renderLessons();
    });

    // Quick link to profile section
    const openProfile = $("#openProfile");
    if (openProfile) openProfile.addEventListener("click", ()=>{
      window.scrollTo({top:0, behavior:"smooth"});
    });
  }

  // ---------- Render klant + honden ----------
  function renderDogs(){
    if (!dogsList) return;
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
          <button class="btn" data-act="edit" type="button">✎ Bewerken</button>
          <button class="btn danger" data-act="del" type="button">🗑 Verwijderen</button>
        </div>
      `;
      const editBtn = li.querySelector('[data-act="edit"]');
      const delBtn  = li.querySelector('[data-act="del"]');
      if (editBtn) editBtn.addEventListener("click", ()=> openDogDialog(d));
      if (delBtn)  delBtn.addEventListener("click", ()=>{
        if(confirm(`Verwijder hond "${d.name || ""}"?`)){
          state.dogs = state.dogs.filter(x=>x.id!==d.id);
          save(key.dogs, state.dogs); renderDogs();
        }
      });
      dogsList.appendChild(li);
    });
  }

  function openDogDialog(dog){
    if (!dogDialog || !dogForm) return;
    dogForm.reset();
    if(dog){
      dogForm.name.value  = dog.name  || "";
      dogForm.breed.value = dog.breed || "";
      dogForm.dob.value   = dog.dob   || "";
      dogForm.sex.value   = dog.sex   || "";
      dogForm.chip.value  = dog.chip  || "";
      dogForm.notes.value = dog.notes || "";
      dogForm.dataset.editId = dog.id;
    }
    if (typeof dogDialog.showModal === "function") dogDialog.showModal();
    else dogDialog.setAttribute("open",""); // fallback zonder dialog support
  }

  function fillClientForm(c={}){
    if (!clientForm) return;
    clientForm.firstName.value = c.firstName || "";
    clientForm.lastName.value  = c.lastName  || "";
    clientForm.email.value     = c.email     || "";
    clientForm.phone.value     = c.phone     || "";
    clientForm.country.value   = c.country   || "";
    clientForm.street.value    = c.street    || "";
    clientForm.streetNo.value  = c.streetNo  || "";
    clientForm.zip.value       = c.zip       || "";
    clientForm.city.value      = c.city      || "";
    clientForm.notes.value     = c.notes     || "";
  }

  // ---------- Render lessen ----------
  function renderLessons(){
    if (!tableWrap) return;
    const list = applyFilters(LESSONS, state.filters);
    tableWrap.innerHTML = "";
    if(list.length===0){
      tableWrap.innerHTML = `<div class="empty">Geen lessen gevonden met deze filters.</div>`;
      return;
    }
    const isMobile = matchMedia("(max-width: 860px)").matches;

    if(!isMobile){
      if (tableTpl && rowTpl) {
        const tableFrag = tableTpl.content ? tableTpl.content.cloneNode(true) : null;
        if (tableFrag) {
          const tb = tableFrag.querySelector("tbody");
          list.forEach(lesson => {
            const rowFrag = renderRow(lesson);
            if (rowFrag) tb.appendChild(rowFrag);
          });
          tableWrap.appendChild(tableFrag);
        } else {
          // fallback: simpele tabel renderen zonder <template>
          const tbl = document.createElement("table");
          tbl.className = "table";
          const thead = document.createElement("thead");
          thead.innerHTML = `<tr><th>Groep</th><th>Datum</th><th>Tijd</th><th>Locatie</th><th>Trainer(s)</th><th></th></tr>`;
          const tbody = document.createElement("tbody");
          list.forEach(lesson => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td class="caps"></td>
              <td class="date"></td>
              <td class="time"></td>
              <td class="loc"></td>
              <td class="trainer"></td>
              <td class="row-actions"></td>
            `;
            tr.querySelector(".caps").textContent = `${lesson.type} • ${lesson.niveau} • ${lesson.groepCap} cap`;
            tr.querySelector(".date").textContent = formatDate(lesson.date);
            tr.querySelector(".time").textContent = `${lesson.start} – ${lesson.end}`;
            tr.querySelector(".loc").innerHTML    = `<a href="${lesson.locatie.maps}" target="_blank" rel="noopener">${escapeHtml(lesson.locatie.name)}</a>`;
            tr.querySelector(".trainer").textContent = lesson.trainers.join(", ");
            tr.querySelector(".row-actions").append(...actionButtons(lesson));
            tbody.appendChild(tr);
          });
          tbl.appendChild(thead); tbl.appendChild(tbody);
          tableWrap.appendChild(tbl);
        }
      }
    } else {
      if (cardTpl && cardTpl.content) {
        list.forEach(lesson => {
          const card = renderCard(lesson);
          if (card) tableWrap.appendChild(card);
        });
      } else {
        // fallback cards
        list.forEach(lesson => {
          const div = document.createElement("div");
          div.className = "card";
          div.innerHTML = `
            <div class="title"></div>
            <div class="meta"></div>
            <div class="row-actions"></div>
          `;
          div.querySelector(".title").textContent = `${lesson.type} • ${lesson.niveau}`;
          div.querySelector(".meta").innerHTML = `
            ${formatDate(lesson.date)} • ${lesson.start}–${lesson.end}<br>
            <a href="${lesson.locatie.maps}" target="_blank" rel="noopener">${escapeHtml(lesson.locatie.name)}</a> • ${lesson.trainers.join(", ")} • cap ${lesson.groepCap}
          `;
          div.querySelector(".row-actions").append(...actionButtons(lesson));
          tableWrap.appendChild(div);
        });
      }
    }
    renderInterestDrawer();
  }

  function renderRow(lesson){
    if (!rowTpl || !rowTpl.content) return null;
    const tr = rowTpl.content.cloneNode(true);
    tr.querySelector(".caps").textContent = `${lesson.type} • ${lesson.niveau} • ${lesson.groepCap} cap`;
    tr.querySelector(".date").textContent = formatDate(lesson.date);
    tr.querySelector(".time").textContent = `${lesson.start} – ${lesson.end}`;
    tr.querySelector(".loc").innerHTML    = `<a href="${lesson.locatie.maps}" target="_blank" rel="noopener">${escapeHtml(lesson.locatie.name)}</a>`;
    tr.querySelector(".trainer").textContent = lesson.trainers.join(", ");
    tr.querySelector(".row-actions").append(...actionButtons(lesson));
    return tr;
  }

  function renderCard(lesson){
    if (!cardTpl || !cardTpl.content) return null;
    const card = cardTpl.content.cloneNode(true);
    card.querySelector(".title").textContent = `${lesson.type} • ${lesson.niveau}`;
    card.querySelector(".meta").innerHTML = `
      ${formatDate(lesson.date)} • ${lesson.start}–${lesson.end}<br>
      <a href="${lesson.locatie.maps}" target="_blank" rel="noopener">${escapeHtml(lesson.locatie.name)}</a> • ${lesson.trainers.join(", ")} • cap ${lesson.groepCap}
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
    signup.textContent = "Aanmelden";
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
    if (!interestDrawer || !interestPills) return;
    const ids = [...state.interest];
    if(ids.length===0){ interestDrawer.hidden = true; interestPills.innerHTML=""; return; }
    interestDrawer.hidden = false;
    interestPills.innerHTML = "";
    ids.map(id => LESSONS.find(l=>l.id===id)).filter(Boolean).forEach(lesson=>{
      const pill = document.createElement("span");
      pill.className="pill";
      pill.innerHTML = `<strong>${escapeHtml(lesson.type)}</strong> · ${formatDate(lesson.date)} · ${lesson.start}`;
      const x = document.createElement("button");
      x.setAttribute("aria-label","Verwijder interesse");
      x.type = "button";
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
    // fetch('/api/inschrijvingen', {...})

    flash(`✅ Inschrijving geregistreerd voor ${picked.name} – ${lesson.type} (${formatDate(lesson.date)} ${lesson.start}).`, 4500);
  }

  function promptSelectDog(dogs){
    const label = dogs.map((d,i)=> `${i+1}) ${d.name} (${d.breed || "ras onbekend"})`).join("\n");
    const ans = prompt(`Welke hond inschrijven?\n${label}\nGeef het nummer (1–${dogs.length}):`, "1");
    const idx = parseInt(ans, 10) - 1;
    if(Number.isNaN(idx) || idx<0 || idx>=dogs.length) return null;
    return dogs[idx];
  }

  // ---------- Utilities ----------
  function applyFilters(list, f){
    const q = (f.q || "").trim().toLowerCase();
    return list
      .filter(l=>{
        const hay = [
          l.type,l.niveau,l.locatie?.name || "",l.trainers?.join(" ") || "", l.id, ...(l.tags||[])
        ].join(" ").toLowerCase();
        const inQ       = !q || hay.includes(q);
        const inType    = !f.type    || l.type===f.type;
        const inLoc     = !f.loc     || (l.locatie?.name === f.loc);
        const inTrainer = !f.trainer || (Array.isArray(l.trainers) && l.trainers.includes(f.trainer));
        return inQ && inType && inLoc && inTrainer;
      })
      .sort((a,b)=> (a.date+a.start).localeCompare(b.date+b.start));
  }

  function formatDate(iso){
    // forceer locale; laat timezone aan browser (Brussels ok)
    const d = new Date(`${iso}T00:00:00`);
    try {
      return new Intl.DateTimeFormat(LOCALE, {
        weekday:"short", day:"2-digit", month:"short", year:"numeric"
      }).format(d);
    } catch {
      return d.toLocaleDateString(LOCALE, {weekday:"short", day:"2-digit", month:"short", year:"numeric"});
    }
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
    setTimeout(()=>{ n.style.opacity="0"; n.style.transform:"translateY(6px)";}, ms);
    setTimeout(()=> n.remove(), ms+220);
  }

  function formToObj(form){
    const fd = new FormData(form);
    return Object.fromEntries(fd.entries());
  }

  function save(k, v){
    try { safeStorage.setItem(k, JSON.stringify(v)); }
    catch (e) { console.warn("save error", e); }
  }

  function load(k){
    try { const raw = safeStorage.getItem(k); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  }

  function uuid(){ return (crypto?.randomUUID ? crypto.randomUUID() : 'id-'+Math.random().toString(36).slice(2)); }

  function escapeHtml(s){
    return String(s ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  }

  // ---------- Mount ----------
  init();
})();
