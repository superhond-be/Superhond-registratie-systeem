// --- “Bron van waarheid” (pas dit aan en laat het dáárna met rust) ---
const SPEC = Object.freeze({
  appName: "Mijn App",
  features: [
    "Formulier: naam + leeftijd -> opslag in memory",
    "Weergave: lijstitems gesorteerd op naam",
    "Validatie: leeftijd 0..120, naam ≥ 2 tekens",
  ]
});
// ---------------------------------------------------------------------

const state = {
  items: /** @type {Array<{name:string, age:number}>} */ ([]),
};

// UI refs
const els = {
  form: /** @type {HTMLFormElement} */ (document.getElementById('demoForm')),
  name: /** @type {HTMLInputElement} */ (document.getElementById('nameInput')),
  age:  /** @type {HTMLInputElement} */ (document.getElementById('ageInput')),
  out:  /** @type {HTMLElement} */ (document.getElementById('output')),
  list: /** @type {HTMLElement} */ (document.getElementById('list')),
  run:  /** @type {HTMLButtonElement} */ (document.getElementById('runTests')),
  overlay: document.getElementById('overlay'),
  closeOverlay: document.getElementById('closeOverlay'),
  errorText: document.getElementById('errorText')
};

// Hard fail -> overlay, zodat fouten niet “stil” blijven
window.addEventListener('error', (e) => showError(e.error ? e.error.stack : String(e.message)));
window.addEventListener('unhandledrejection', (e) => showError(e.reason?.stack ?? String(e.reason)));

function showError(msg){
  els.errorText.textContent = msg;
  els.overlay.classList.remove('hidden');
}
els.closeOverlay.addEventListener('click', () => els.overlay.classList.add('hidden'));

// Pure functie: valideer invoer
function validate(name, age){
  const errors = [];
  if(!name || name.trim().length < 2) errors.push("Naam moet minstens 2 tekens hebben.");
  const nAge = Number(age);
  if(!Number.isFinite(nAge) || nAge < 0 || nAge > 120) errors.push("Leeftijd moet tussen 0 en 120 liggen.");
  return errors;
}

// Pure functie: insert + sort
function upsert(items, entry){
  const next = items.slice();
  next.push(entry);
  next.sort((a,b)=> a.name.localeCompare(b.name, 'nl', {sensitivity:'base'}));
  return next;
}

// Render
function render(){
  els.list.innerHTML = '';
  for(const it of state.items){
    const li = document.createElement('li');
    li.textContent = `${it.name} — ${it.age}`;
    els.list.appendChild(li);
  }
  els.out.textContent = JSON.stringify(state.items, null, 2);
}

// Submit
els.form.addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = els.name.value.trim();
  const age = Number(els.age.value);
  const errs = validate(name, age);
  if(errs.length){ showError(errs.join("\n")); return; }
  state.items = upsert(state.items, {name, age});
  render();
  els.form.reset();
  els.name.focus();
});

// --- Mini-testjes om regressies te voorkomen ---
els.run.addEventListener('click', ()=>{
  const t = createTestRunner();
  t.eq(validate("", 10).length > 0, true, "lege naam afgekeurd");
  t.eq(validate("Bo", 999).length > 0, true, "te hoge leeftijd afgekeurd");
  const sorted = upsert([], {name:"Zoe", age:1});
  const sorted2 = upsert(sorted, {name:"Ali", age:2});
  t.eq(sorted2[0].name, "Ali", "sorteert alfabetisch");
  t.report();
});

// Testhulp
function createTestRunner(){
  /** @type {Array<{name:string, ok:boolean, msg?:string}>} */
  const results = [];
  return {
    eq(actual, expected, name){
      const ok = Object.is(actual, expected);
      results.push({name, ok, msg: ok ? undefined : `Expected ${String(expected)}, got ${String(actual)}`});
    },
    report(){
      const okCount = results.filter(r=>r.ok).length;
      const fail = results.filter(r=>!r.ok);
      const icon = fail.length ? "❌" : "✅";
      const summary = `${icon} ${okCount}/${results.length} tests geslaagd`;
      if(fail.length){
        showError(summary + "\n\n" + fail.map(f=>`• ${f.name}: ${f.msg}`).join("\n"));
      } else {
        els.out.textContent = summary;
      }
    }
  };
}

// Eerste render
render();
console.info("SPEC:", SPEC);
