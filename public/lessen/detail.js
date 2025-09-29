async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const loader = document.getElementById("loader");
  const error = document.getElementById("error");
  const detail = document.getElementById("les-detail");

  try {
    const response = await fetch("/data/lessen.json");
    const data = await response.json();

    const les = data.find(item => String(item.id) === id);

    if (!les) {
      throw new Error(`Les met id=${id} niet gevonden`);
    }

    loader.style.display = "none";
    detail.style.display = "block";
    detail.innerHTML = `
      <h2>${les.titel}</h2>
      <p><strong>Datum:</strong> ${les.datum}</p>
      <p><strong>Locatie:</strong> ${les.locatie}</p>
      <p><strong>Trainer:</strong> ${les.trainer}</p>
    `;
  } catch (err) {
    loader.style.display = "none";
    error.style.display = "block";
    error.textContent = "⚠️ " + err.message;
  }
}

document.addEventListener("DOMContentLoaded", init);
