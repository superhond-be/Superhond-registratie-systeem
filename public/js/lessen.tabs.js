import { loadAll } from "/js/lessen.store.js";

const tabs = document.getElementById("tabs");
const view = document.getElementById("view");

let state = { namen:[], types:[], locaties:[], themas:[], trainers:[], lessen:[], reeksen:[] };

const routes = {
  names:    () => import("/js/tabs/names.js"),
  types:    () => import("/js/tabs/types.js"),
  locations:() => import("/js/tabs/locations.js"),
  themes:   () => import("/js/tabs/themes.js"),
  trainers: () => import("/js/tabs/trainers.js"),
  beheer:   () => import("/js/tabs/beheer.js"),
};

function setActive(name){
  tabs.querySelectorAll('.pill').forEach(b=>{
    b.setAttribute('aria-current', b.dataset.tab===name ? 'page' : 'false');
  });
}

async function renderTab(name){
  setActive(name);
  view.innerHTML = `<p class="muted">Laden…</p>`;
  const mod = await routes[name]();
  await mod.render(view, state);     // elke tab exporteert render(view, state)
}

tabs.addEventListener("click", async (e)=>{
  const btn = e.target.closest(".pill[data-tab]");
  if (!btn) return;
  renderTab(btn.dataset.tab);
});

(async function init(){
  // Laad alle basislijsten één keer
  const all = await loadAll(); // verwacht {lessen, reeksen, locaties, trainers, types, themas, namen?}
  // Houd alles bij in 1 state-object
  state = { ...state, ...all };
  renderTab("names");          // start op “Namen”
})();
