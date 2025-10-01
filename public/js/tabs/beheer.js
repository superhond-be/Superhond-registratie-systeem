import { lists } from "/js/lessen.store.js"; // als je select-helpers al hebt

export async function render(host, state){
  const lessen = (state.lessen||[]).slice().sort((a,b)=>String(a.datum+a.start).localeCompare(String(b.datum+b.start)));
  const locById  = new Map((state.locaties||[]).map(x=>[String(x.id), x]));
  const trById   = new Map((state.trainers||[]).map(x=>[String(x.id), x]));
  const reeksById= new Map((state.reeksen ||[]).map(x=>[String(x.id), x]));

  const tds = lessen.map(l=>{
    const r = reeksById.get(String(l.reeksId))?.naam || l.naam || "—";
    const loc = locById.get(String(l.locatieId))?.naam || "—";
    const tr  = trById.get(String(l.trainerId));
    const trainer = tr ? [tr.voornaam,tr.achternaam].filter(Boolean).join(" ") : "—";
    return `
      <tr>
        <td>${r}</td>
        <td>${l.type||'—'}</td>
        <td>${loc}</td>
        <td>${l.thema||'—'}</td>
        <td>${trainer}</td>
        <td>${l.datum||'—'}</td>
        <td>${l.start||'—'}</td>
        <td>${l.eindtijd||'—'}</td>
        <td>${l.capaciteit ?? '—'}</td>
      </tr>`;
  }).join('');

  host.innerHTML = `
    <div class="card">
      <h2 style="margin:0 0 .5rem">Beheer</h2>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Naam</th><th>Type</th><th>Locatie</th><th>Thema</th>
              <th>Trainers</th><th>Datum</th><th>Begintijd</th><th>Eindtijd</th><th>Cap.</th>
            </tr>
          </thead>
          <tbody>${tds || `<tr><td colspan="9"><em>Nog geen lessen</em></td></tr>`}</tbody>
        </table>
      </div>
      <p class="muted">Swipe/scroll → om alle kolommen te zien. Later: ✏️ bewerken, 💾 opslaan, ↩︎ annuleren.</p>
    </div>
  `;
}
