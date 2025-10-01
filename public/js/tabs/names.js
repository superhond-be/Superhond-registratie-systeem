export async function render(host, state){
  host.innerHTML = `
    <div class="toolbar" style="display:flex;gap:.5rem;align-items:center">
      <button class="btn primary" id="add">+ Naam toevoegen</button>
      <span class="muted">${(state.reeksen||[]).length} reeksen</span>
    </div>
    <div class="table-wrap" style="margin-top:.5rem">
      <table class="table"><thead>
        <tr><th>Naam</th><th class="right">Acties</th></tr>
      </thead><tbody>
        ${(state.reeksen||[]).map(r=>`
          <tr>
            <td>${r.naam||'-'}</td>
            <td class="right"><button class="btn btn-xs">✏️</button></td>
          </tr>`).join('') || `<tr><td colspan="2"><em>Geen data</em></td></tr>`}
      </tbody></table>
    </div>
  `;
}
