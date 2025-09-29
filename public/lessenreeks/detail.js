async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const loader = document.getElementById("loader");
  const error = document.getElementById("error");
  const detail = document.getElementById("reeks-detail");

  try {
    const response = await fetch("/data/lessenreeksen.json");
    const data = await response.json();

    const reeks = data.find(item => String(item.id) === id);

    if (!reeks) {
      throw new Error(`Reeks met id=${id} niet gevonden`);
    }

    loader.style.display = "none";
    detail.style.display = "block";
    detail.innerHTML = `
      <h2>${reeks.titel}</h2>
      <p><strong>Startdatum:</strong> ${reeks.startdatum}</p>
      <p><strong>Aantal lessen:</strong> ${reeks.lessen.length}</p>
      <h3>Lessen in deze reeks:</h3>
      <ul>
        ${reeks.lessen.map(lesId => `<li><a href="/lessen/detail.html?id=${lesId}">Les ${lesId}</a></li>`).join("")}
      </ul>
    `;
  } catch (err) {
    loader.style.display = "none";
    error.style.display = "block";
    error.textContent = "⚠️ " + err.message;
  }
}

document.addEventListener("DOMContentLoaded", init);
