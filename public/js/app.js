// Centrale metadata
const VERSION = "v0.5";
const BUILD_TIMESTAMP = "2025-09-23 09:08:31 (Europe/Brussels)";

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".version").forEach(el => el.textContent = VERSION);
  document.querySelectorAll("#verLabel").forEach(el => el.textContent = VERSION);
  document.querySelectorAll(".build").forEach(el => el.textContent = "Build " + BUILD_TIMESTAMP);

  // Toggle active state knoppen (indien aanwezig op home.html)
  document.querySelectorAll('.switch .btn').forEach(button => {
    button.addEventListener('click', () => {
      const group = button.closest('.switch');
      if (!group) return;
      group.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
    });
  });
});
