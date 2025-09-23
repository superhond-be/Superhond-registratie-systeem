// Centraal versienummer
const VERSION = "v0.4";

document.addEventListener("DOMContentLoaded", () => {
  const versionSpans = document.querySelectorAll(".version");
  versionSpans.forEach(el => el.textContent = VERSION);

  const verLabels = document.querySelectorAll("#verLabel");
  verLabels.forEach(el => el.textContent = VERSION);

  // Toggle active state knoppen (indien aanwezig)
  document.querySelectorAll('.switch .btn').forEach(button => {
    button.addEventListener('click', () => {
      const group = button.closest('.switch');
      if (!group) return;
      group.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
    });
  });
});
