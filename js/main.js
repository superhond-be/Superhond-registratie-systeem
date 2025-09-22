// main.js (module scope)
const APP_ID = "app";
const LAYOUTS = ["superhond", "raster", "blog"];
const STORAGE_KEY = "superhond-layout";

const $ = (sel, root = document) => {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`Element niet gevonden: ${sel}`);
  return el;
};
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function getRoot() {
  const root = document.getElementById(APP_ID);
  if (!root) throw new Error("#app ontbreekt");
  return root;
}

function getURLLayout() {
  const p = new URLSearchParams(location.search);
  const q = (p.get("layout") || "").toLowerCase();
  return LAYOUTS.includes(q) ? q : null;
}

function applyLayout(layout) {
  const root = getRoot();
  if (!LAYOUTS.includes(layout)) layout = LAYOUTS[0];
  root.dataset.layout = layout;
  localStorage.setItem(STORAGE_KEY, layout);
  // UI state
  $$(".layout-switch .btn").forEach(btn => {
    btn.classList.toggle("btn--accent", btn.dataset.switch === layout);
  });
  // Sync URL zonder reload
  const url = new URL(location.href);
  url.searchParams.set("layout", layout);
  history.replaceState({}, "", url);
}

function initSwitch() {
  $$(".layout-switch [data-switch]").forEach(btn => {
    btn.addEventListener("click", () => applyLayout(btn.dataset.switch));
  });
}

function initActions() {
  const knop = $("#actieKnop");
  knop.addEventListener("click", () => {
    const active = getRoot().dataset.layout;
    alert(`Actie vanuit layout: ${active} 🚀`);
  });
}

function boot() {
  const urlLayout = getURLLayout();
  const stored = localStorage.getItem(STORAGE_KEY);
  const initial = urlLayout || stored || LAYOUTS[0];
  applyLayout(initial);
  initSwitch();
  initActions();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
