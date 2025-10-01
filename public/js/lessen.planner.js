// Superhond — Weekplanner (filters + weeknavigatie)
import { loadAll, date } from "/js/lessen.store.js";

const grid  = document.getElementById("grid");
const count = document.getElementById("count");
const range = document.getElementById("range");

const selReeks   = document.getElementById("filter-reeks");
const selTrainer = document.getElementById("filter-trainer");
const selLocatie = document.getElementById("filter-locatie");
const selType    = document.getElementById("filter-type");

const btnPrev = document.getElementById("prev");
const btnNext = document.getElementById("next");
const btnToday= document.getElementById("today");

let state = { lessen:[], reeksen:[], locaties:[], trainers:[] };
let weekStart = date.startOfWeek(new Date());

const S = v => String(v ?? "");

function nameTrainer(t){ return [t?.voornaam, t?.achternaam].filter(Boolean).join(" "); }
function nameReeks(id){ return (state.reeksen.find(r=>String(r.id)===String(id))?.naam) || "—"; }
function nameLoc(id){ return (state.locaties.find(l=>String(l.id)===String(id))?.naam) || "—"; }

function fillFilters() {
  selReeks.innerHTML = `<option value="">— Reeks —</option>` +
    state.reeksen.map(r=>`<option value="${r.id}">${r.naam}</option>`).join("");
  selTrainer.innerHTML = `<option value="">— Trainer —</option>` +
    state.trainers.map(t=>`<option value="${t.id}">${nameTrainer(t)}</option>`).join("");
  selLocatie.innerHTML = `<option value="">— Locatie —</option>` +
    state.locaties.map(l=>`<option value="${l.id}">${l.naam}</option>`).join("");
}

function withinWeek(les) {
  const d = new Date(les.datum);
  const end = date.addDays(weekStart, 7);
  return d >= weekStart && d < end;
}

function applyFilters(list) {
  const r = selReeks.value, tr = selTrainer.value, lo = selLocatie.value, ty = selType.value;
  return list.filter(l =>
    (!r  || String(l.reeksId)  === r)  &&
    (!tr || String(l.trainerId)=== tr) &&
    (!lo || String(l.locatieId)=== lo) &&
    (!ty || String(l.type)     === ty)
  );
}

function dayColTitle(d) {
  return d.toLocaleDateString("nl-BE", { weekday:"long", day:"2-digit", month:"short" });
}

function itemCard(les){
  const tr = state.trainers.find(t=>String(t.id)===String(les.trainerId));
  const loc= state.locaties.find(l=>String(l.id)===String(les.locatieId));
  return `
    <div class="card" style="padding:8px">
      <div style="font-weight:700">${nameReeks(les.reeksId)} <span class="muted">(${S(les.type)})</span></div>
      <div class="muted">${S(les.start)}${les.einde?`–${S(les.einde)}`:""} • ${tr?nameTrainer(tr):"—"} • ${loc?loc.naam:"—"}</div>
      <div style="margin-top:.35rem;display:flex;gap:.5rem">
        <a class="btn btn-xs" href="/lessen/detail.html?id=${encodeURIComponent(les.id)}">Open</a>
        <a class="btn btn-xs primary" href="/inschrijven/?lesId=${encodeURIComponent(les.id)}">Schrijf in</a>
      </div>
    </div>
  `;
}

function renderGrid(){
  const days = [...Array(7)].map((_,i)=>date.addDays(weekStart,i));
  range.textContent = `${date.fmtNL(days[0])} – ${date.fmtNL(days[6])}`;

  // filter op week + filters
  const filtered = applyFilters(state.lessen.filter(withinWeek));
  count.textContent = `${filtered.length} lessen`;

  // groepeer per dag
  const byDay = new Map();
  days.forEach(d => byDay.set(date.fmtISO(d), []));
  filtered.forEach(l => {
    const key = l.datum?.slice(0,10);
    if (byDay.has(key)) byDay.get(key).push(l);
  });

  // render
  let html = `<div style="display:grid;gap:12px;grid-template-columns:repeat(7,1fr)">`;
  days.forEach(d => {
    const key = date.fmtISO(d);
    const list = (byDay.get(key) || []).sort((a,b)=>S(a.start).localeCompare(S(b.start)));
    html += `
      <div>
        <div style="font-weight:700;margin:6px 0">${dayColTitle(d)}</div>
        <div style="display:grid;gap:8px">
          ${list.length ? list.map(itemCard).join("") : `<div class="muted">—</div>`}
        </div>
      </div>
    `;
  });
  html += `</div>`;
  grid.innerHTML = html;
}

/* events */
[selReeks, selTrainer, selLocatie, selType].forEach(el => el.addEventListener("change", renderGrid));
btnPrev.addEventListener("click", ()=>{ weekStart = date.addDays(weekStart, -7); renderGrid(); });
btnNext.addEventListener("click", ()=>{ weekStart = date.addDays(weekStart, +7); renderGrid(); });
btnToday.addEventListener("click", ()=>{ weekStart = date.startOfWeek(new Date()); renderGrid(); });

/* init */
(async function init(){
  try {
    state = await loadAll();
    // sorteer t.b.v. UX
    state.lessen.sort((a,b)=>S(a.datum+a.start).localeCompare(S(b.datum+b.start)));
    fillFilters();
    renderGrid();
  } catch (e) {
    grid.innerHTML = `<p class="error">⚠️ Kon planner niet laden: ${S(e.message)}</p>`;
  }
})();
