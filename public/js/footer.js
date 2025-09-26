// Toont versie in footer; werkt met API én met statisch /version.json
async function updateFooterVersion() {
  const el = document.getElementById("version-info");
  const set = d => {
    const t = d.buildTime
      ? new Date(d.buildTime).toLocaleString("nl-BE", {
          timeZone: "Europe/Brussels", // altijd Belgische tijd
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        })
      : "";

    if (el) el.textContent = `v${d.version} (${d.commit || "?"})${t ? " — " + t : ""}`;
  };

  // 1) Probeer backend endpoint
  try {
    const r = await fetch(`/api/version?b=${Date.now()}`);
    if (!r.ok) throw 0;
    set(await r.json());
    return;
  } catch {}

  // 2) Fallback: statisch bestand
  try {
    const r2 = await fetch(`/version.json?b=${Date.now()}`);
    set(await r2.json());
  } catch {
    if (el) el.textContent = "⚠️ versie niet beschikbaar";
  }
}

document.addEventListener("DOMContentLoaded", updateFooterVersion);
