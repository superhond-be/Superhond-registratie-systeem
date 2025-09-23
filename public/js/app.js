const VERSION = "v0.7";
const BUILD_TIMESTAMP = "2025-09-23 09:16:06 (Europe/Brussels)";

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".version").forEach(el => el.textContent = VERSION);
  document.querySelectorAll("#verLabel").forEach(el => el.textContent = VERSION);
  document.querySelectorAll(".build").forEach(el => el.textContent = "Build " + BUILD_TIMESTAMP);

  // Simple search filter in Module B
  const searchInput = document.getElementById("search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const filter = searchInput.value.toLowerCase();
      document.querySelectorAll(".datatable tbody tr").forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(filter) ? "" : "none";
      });
    });
  }
});
