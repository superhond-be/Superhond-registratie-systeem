// /public/js/footer.js
async function updateFooterVersion() {
  try {
    // Cache-buster om Safari/iPad te slim af te zijn
    const res = await fetch(`/api/version?b=${Date.now()}`);
    if (!res.ok) throw new Error("API error");

    const data = await res.json();
    const footer = document.getElementById("version-info");

    if (footer) {
      const buildTime = new Date(data.buildTime).toLocaleString();
      footer.textContent = `v${data.version} (${data.commit || "?"}) – ${buildTime}`;
    }
  } catch (err) {
    console.error("Versie ophalen mislukt:", err);
    const footer = document.getElementById("version-info");
    if (footer) {
      footer.textContent = "⚠️ API offline";
    }
  }
}

// Automatisch starten zodra de pagina geladen is
document.addEventListener("DOMContentLoaded", updateFooterVersion);
