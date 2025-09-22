// ====== Config & helpers ======
const LAYOUTS = ["superhond", "raster", "blog"];
const STORAGE_KEY = "superhond:dogs";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => crypto.randomUUID();

// ====== State ======
let dogs = [];

// ====== Layout wissel ======
function applyLayout(layout) {
  const root = $("#app");
  if (!LAYOUTS.includes(layout)) layout = LAYOUTS[0];
  root.dataset.layout = layout;

  $$(".switch .btn").forEach(btn => {
    const active = btn.dataset.switch === layout;
    btn.classList.toggle("btn--accent", active);
    btn.setAttribute("aria-pressed", String(active));
  });

  const url = new URL(location.href);
  url.searchParams.set("layout", layout);
  history.replaceState({}, "", url);
  localStorage.setItem("layout", layout);
}

// ====== Opslag ======
function loadDogs() {
  try {
    dogs = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(dogs)) dogs = [];
  } catch { dogs = []; }
}
function saveDogs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dogs));
}

// ====== Validatie ======
function validate(form) {
  let ok = true;
  const setErr = (name, msg) => {
    const field = form.querySelector(`[name="${name}"]`);
    const el = field.closest(".field").querySelector(".error");
    el.textContent = msg || "";
    if (msg) ok = false;
  };

  const name = form.name.value.trim();
  const breed = form.breed.value.trim();
  const age = Number(form.age.value);
  const owner = form.owner.value.trim();

  setErr("name", name.length < 2 ? "Min. 2 letters" : "");
  setErr("breed", breed.length < 2 ? "Min. 2 letters" : "");
  setErr("age", Number.isNaN(age) || age < 0 || age > 25 ? "0–25" : "");
  setErr("owner", owner.length < 2 ? "Min. 2 letters" : "");

  return ok;
}

// ====== Render lijst ======
function renderList(filter = "") {
  const tbody = $("#dog-tbody");
  tbody.innerHTML = "";

  const q = filter.trim().toLowerCase();
  const rows = dogs.filter(d =>
    !q ||
    d.name.toLowerCase().includes(q) ||
    d.breed.toLowerCase().includes(q) ||
    d.owner.toLowerCase().includes(q)
  );

  for (const d of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(d.name)}</td>
      <td>${escapeHTML(d.breed)}</td>
      <td>${d.age}</td>
      <td>${escapeHTML(d.owner)}</td>
      <td>${escapeHTML(d.chip || "")}</td>
      <td>
        <div class="actions">
          <button class="link" data-edit="${d.id}">Bewerk</button>
          <button class="link" data-del="${d.id}">Verwijder</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // Acties
  tbody.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => startEdit(btn.dataset.edit))
  );
  tbody.querySelectorAll("[data-del]").forEach(btn =>
    btn.addEventListener("click", () => removeDog(btn.dataset.del))
  );

  $("#count").textContent = `${rows.length} / ${dogs.length} getoond`;
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}

// ====== CRUD ======
function upsertDog(payload) {
  const i = dogs.findIndex(d => d.id === payload.id);
  if (i === -1) dogs.unshift(payload);
  else dogs[i] = payload;
  saveDogs();
  renderList($("#search").value);
}

function startEdit(id) {
  const d = dogs.find(x => x.id === id);
  if (!d) return;
  const form = $("#dog-form");
  form.id.value = d.id;
  form.name.value = d.name;
  form.breed.value = d.breed;
  form.age.value = d.age;
  form.owner.value = d.owner;
  form.chip.value = d.chip || "";
  form.contact.value = d.contact || "";
  form.querySelector('[type="submit"]').textContent = "Bijwerken";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function removeDog(id) {
  if (!confirm("Verwijderen?")) return;
  dogs = dogs.filter(d => d.id !== id);
  saveDogs();
  renderList($("#search").value);
}

// ====== Event handlers ======
function initForm() {
  const form = $("#dog-form");

  // Submit
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (!validate(form)) return;

    const input = Object.fromEntries(new FormData(form).entries());
    const dog = {
      id: input.id || uid(),
      name: input.name.trim(),
      breed: input.breed.trim(),
      age: Number(input.age),
      owner: input.owner.trim(),
      chip: input.chip.trim(),
      contact: input.contact.trim()
    };

    upsertDog(dog);
    form.reset();
    form.id.value = "";
    form.querySelector('[type="submit"]').textContent = "Opslaan";
  });

  // Live validatie bij blur
  form.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("blur", () => validate(form));
  });

  // Reset
  $("#reset-btn").addEventListener("click", () => {
    form.querySelectorAll(".error").forEach(e => (e.textContent = ""));
    form.id.value = "";
    form.querySelector('[type="submit"]').textContent = "Opslaan";
  });
}

function initListControls() {
  $("#search").addEventListener("input", e => renderList(e.target.value));
  $("#export-json").addEventListener("click", () => {
    const data = JSON.stringify(dogs, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "superhond-export.json" });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });
  $("#clear-all").addEventListener("click", () => {
    if (!confirm("Alles leegmaken?")) return;
    dogs = [];
    saveDogs();
    renderList($("#search").value);
  });
}

// ====== Boot ======
function boot() {
  // Layout init
  const urlQ = new URLSearchParams(location.search).get("layout");
  const savedLayout = localStorage.getItem("layout");
  applyLayout(urlQ || savedLayout || LAYOUTS[0]);
  $$(".switch .btn").forEach(b => b.addEventListener("click", () => applyLayout(b.dataset.switch)));

  // Data + UI
  loadDogs();
  initForm();
  initListControls();
  renderList("");
}

document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", boot, { once: true })
  : boot();
