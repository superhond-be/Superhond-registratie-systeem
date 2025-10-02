// detail.js – toont details van een lessenreeks
async function fetchJson(urls) {
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (r.ok) return r.json();
    } catch {}
  }
  throw new Error("Geen data gevonden");
}

function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}

document.addEventListener("DOMContentLoaded", async () => {
  const id = getParam("id");
  const loader = document.getElementById("loader");
  const errorBox = document.getElementById("error");
  const detail = document.getElementById("detail");

  try {
    const data = await fetchJson(["../data/lessenreeksen.json"]);
    const reeks = data.find(r => String(r.id) === String(id));

    if (!reeks) {
      throw new Error("Geen reeks gevonden met id " + id);
    }

    document.getElementById("reeksTitel").textContent = reeks.naam;
    document.getElementById("naam").textContent = reeks.naam;
    document.getElementById("type").textContent = reeks.type;
    document.getElementById("thema").textContent = reeks.thema;
    document.getElementById("aantal").textContent = reeks.aantalLessen || "—";
    document.getElementById("prijs").textContent = reeks.prijs || "—";
    document.getElementById("status").textContent = reeks.status || "—";

    // lessenlijst
    const ul = document.getElementById("lessenLijst");
    (reeks.lessen || []).forEach(l => {
      const li = document.createElement("li");
      li.textContent = `${l.datum} – ${l.start} (${l.locatie || "locatie n.n.b."})`;
      ul.appendChild(li);
    });

    loader.style.display = "none";
    detail.style.display = "block";
  } catch (e) {
    loader.style.display = "none";
    errorBox.textContent = e.message;
    errorBox.style.display = "block";
  }
});
