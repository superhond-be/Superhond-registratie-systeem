// /public/js/footer.js
async function updateFooterVersion() {
  try {
    const res = await fetch(`/api/version?b=${Date.now()}`);
    if (!res.ok) throw new Error("API error");

    const data = await res.json();
    const footer = document.getElementById("version-info");

    if (footer) {
      footer.textContent = `v${data.version} (${data.commit || "?"})`;
    }
  } catch (err) {
    console.error("Versie ophalen mislukt:", err);
    const footer = document.getElementById("version-info");
    if (footer) {
      footer.textContent = "⚠️ API offline";
    }
  }
}

// Start automatisch zodra de pagina geladen is
document.addEventListener("DOMContentLoaded", updateFooterVersion);
