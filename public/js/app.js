// Centraal versienummer
const VERSION = "v0.3";

document.addEventListener("DOMContentLoaded", () => {
  const versionSpan = document.querySelector(".version");
  if (versionSpan) versionSpan.textContent = VERSION;

  const verLabel = document.getElementById("verLabel");
  if (verLabel) verLabel.textContent = VERSION;

  // Toggle active state knoppen
  document.querySelectorAll('.switch .btn').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.switch .btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
    });
  });

  // Dashboard knop actie
  const dashBtn = document.querySelector('.dashboard');
  if (dashBtn) {
    dashBtn.addEventListener('click', () => {
      alert('Ga naar Dashboard (actie kan later ingevuld worden)');
    });
  }
});
