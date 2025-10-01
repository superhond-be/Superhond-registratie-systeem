// Superhond layout (topbar + footer) — v0.19.x
window.SuperhondUI = {
  mount(opts = {}) {
    const version = opts.version || "v0.19.x";
    const appTitle = opts.title || "Superhond";
    const icon = opts.icon || "🐶";
    const isHome = !!opts.home;
    const backHref = opts.back || "/";

    // TOPBAR
    const top = document.getElementById("topbar");
    if (top) {
      top.innerHTML = `
        <div class="container" style="display:flex;align-items:center;gap:12px;min-height:56px">
          ${isHome ? "" : `<a class="btn-back" href="${backHref}">← Terug</a>`}
          <h1 class="brand" style="margin:0;font-size:20px;font-weight:800">${icon} ${appTitle}</h1>
          <span class="version-badge" style="margin-left:auto">${version}</span>
        </div>
      `;
      top.classList.add("topbar");
    }

    // FOOTER
    const foot = document.getElementById("footer");
    if (foot) {
      const builtAt = new Date().toLocaleString("nl-BE");
      foot.innerHTML = `
        <div class="container" style="color:#6b7280;padding:14px 16px;border-top:1px solid #e5e7eb">
          © Superhond 2025 — ${version} (static) — ${builtAt}<br>
          <span class="muted">API offline — static versie gebruikt</span>
        </div>
      `;
    }
  }
};
