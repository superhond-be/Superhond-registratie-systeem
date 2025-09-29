// js/layout.js
(async function initLayout() {
  // Topbar injectie (optioneel – laat zo als je dit al had)
  const topbar = document.getElementById("topbar");
  if (topbar) {
    topbar.innerHTML = `
      <div class="topbar-inner">
        <div class="brand">🐶 Superhond</div>
        <div class="version-pill" id="version-pill"></div>
      </div>`;
  }

  // Version info laden (API → fallback naar static)
  let info = null;
  async function loadVersion() {
    try {
      const r = await fetch("/api/version", { cache: "no-store" });
      if (!r.ok) throw new Error("api not ok");
      info = await r.json();
      info.apiOnline = true;
    } catch {
      const r2 = await fetch("/data/version.json", { cache: "no-store" });
      info = await r2.json();
      info.apiOnline = info.apiOnline ?? false;
    }
    return info;
  }

  function formatDate(isoLike) {
    try {
      const d = new Date(isoLike);
      return d.toLocaleString("nl-BE", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
      });
    } catch {
      return isoLike; // fallback raw
    }
  }

  function renderFooter(info) {
    const footer = document.getElementById("footer");
    if (!footer) return;

    const built = formatDate(info.builtAt);
    const channel = info.channel ? ` (${info.channel})` : "";
    const status = info.apiOnline
      ? "API online"
      : "API offline — static versie gebruikt";

    footer.innerHTML = `
      <div class="footer-inner">
        <small>
          © Superhond 2025 — v${info.version}${channel} — ${built}<br>
          ${status}
        </small>
      </div>`;
  }

  function renderVersionPill(info) {
    const pill = document.getElementById("version-pill");
    if (!pill) return;
    pill.textContent = `v${info.version}`;
    pill.title = `Gebouwd: ${formatDate(info.builtAt)} • ${info.apiOnline ? "API online" : "API offline"}`;
  }

  const v = await loadVersion();
  renderFooter(v);
  renderVersionPill(v);
})();
