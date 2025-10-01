export async function render(host, state){
  const locs = state.locaties || [];
  host.innerHTML = `
    <div class="toolbar"><button class="btn primary">+ Locatie</button></div>
    <div class="table-wrap" style="margin-top:.5rem">
      <table class="table"><thead>
        <tr><th>Locatie</th><th>Adres</th><th>Plaats</th><th>Land</th><th class="right">Acties</th></tr>
      </thead><tbody>
        ${locs.map(l=>`
          <tr>
            <td>${l.naam||'-'}</td>
            <td>${l.adres||'-'}</td>
            <td>${l.plaats||'-'}</td>
            <td>${l.land||'-'}</td>
            <td class="right"><button class="btn btn-xs">✏️</button></td>
          </tr>`).join('') || `<tr><td colspan="5"><em>Geen locaties</em></td></tr>`}
      </tbody></table>
    </div>
  `;
}
