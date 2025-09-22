// Geen globals buiten dit bestand
const LAYOUTS = ["superhond", "raster", "blog"];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function applyLayout(layout) {
  const root = $("#app");
  if (!LAYOUTS.includes(layout)) layout = LAYOUTS[0];
  root.dataset.layout = layout;

  // UI-knoppen + ARIA
  $$(".switch .btn").forEach(btn => {
    const active = btn.dataset.switch === layout;
    btn.classList.toggle("btn--accent", active);
    btn.setAttribute("aria-pressed", String(active));
  });

  // URL sync + remember
  const url = new URL(location.href);
  url.searchParams.set("layout", layout);
  history.replaceState({}, "", url);
  localStorage.setItem("layout", layout);
}

function boot() {
  // Init layout
  const urlQ = new URLSearchParams(location.search).get("layout");
  const saved = localStorage.getItem("layout");
  applyLayout(urlQ || saved || LAYOUTS[0]);

  // Listeners
  $$(".switch .btn").forEach(b => b.addEventListener("click", () => applyLayout(b.dataset.switch)));
  $("#actie").addEventListener("click", () => alert(`Layout: ${$("#app").dataset.layout} 🚀`));
}

document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", boot, { once: true })
  : boot();
