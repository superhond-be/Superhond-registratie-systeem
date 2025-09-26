// Footer + badge met Belgische tijd; API-first met fallback naar version.json
async function updateFooterVersion() {
  const footerEl = document.getElementById("version-info");
  const badgeEl  = document.getElementById("header-version");

  const set = d => {
    const t = d.buildTime
      ? new Date(d.buildTime).toLocaleString("nl-BE", {
          timeZone: "Europe/Brussels",
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit", second: "2-digit"
        })
      : "";
    const text = `v${d.version} (${d.commit || "?"})${t ? " — " + t : ""}`;
    if (footerEl) footerEl.textContent = text;
    if (badgeEl)  badgeEl.textContent  = `v${d.version}`;
  };

  // 1) Probeer backend endpoint (voor later)
  try {
    const r = await fetch(`/api/version?b=${Date.now()}`);
    if (!r.ok) throw 0;
    set(await r.json());
    return;
  } catch {}

  // 2) Fallback: statische versie
  try {
    const r2 = await fetch(`/version.json?b=${Date.now()}`);
    set(await r2.json());
  } catch {
    if (footerEl) footerEl.textContent = "⚠️ versie niet beschikbaar";
    if (badgeEl)  badgeEl.textContent  = "v?";
  }
}
document.addEventListener("DOMContentLoaded", updateFooterVersion);
