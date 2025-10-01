// Converter: lessen.json → agenda.json
// Run in de browser of via Node (met kleine aanpassing)

async function buildAgenda() {
  try {
    const res = await fetch("/data/lessen.json", { cache:"no-store" });
    if (!res.ok) throw new Error("lessen.json niet gevonden");
    const lessen = await res.json();

    const agenda = lessen.map(l => ({
      id: l.id,
      type: "les",
      naam: l.naam || "Onbekende les",
      datum: l.datum + "T" + (l.start || "00:00"),
      locatie: l.locatie || ""
    }));

    // Demo: voeg ook vaste mededeling toe
    agenda.push({
      id: "med1",
      type: "mededeling",
      naam: "Herfstvakantie: geen les",
      datum: "2025-10-26T00:00:00",
      locatie: ""
    });

    // Download als agenda.json
    const blob = new Blob([JSON.stringify(agenda, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "agenda.json"; a.click();
    URL.revokeObjectURL(url);

    console.log("✅ agenda.json gegenereerd", agenda);
  } catch (e) {
    console.error("⚠️ Fout bij bouwen agenda:", e);
    alert("Kon agenda niet bouwen: " + e.message);
  }
}

// Start meteen
buildAgenda();
