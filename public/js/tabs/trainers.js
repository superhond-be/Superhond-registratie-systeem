export async function render(host, state){
  const trainers = state.trainers || [];
  host.innerHTML = `
    <div class="toolbar"><button class="btn primary">+ Trainer</button></div>
    <div class="table-wrap" style="margin-top:.5rem">
      <table class="table"><thead><tr><th>Naam</th><th>Email</th><th class="right">Acties</th></tr></thead>
      <tbody>
        ${trainers.map(t=>`
          <tr>
            <td>${[t.voornaam,t.achternaam].filter(Boolean).join(' ')||'-'}</td>
            <td>${t.email||'-'}</td>
            <td class="right"><button class="btn btn-xs">✏️</button></td>
          </tr>`).join('') || `<tr><td colspan="3"><em>Geen trainers</em></td></tr>`}
      </tbody></table>
    </div>
  `;
}
