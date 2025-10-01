export async function render(host, state){
  const types = state.types || [];
  host.innerHTML = `
    <div class="toolbar"><button class="btn primary">+ Type</button></div>
    <div class="table-wrap" style="margin-top:.5rem">
      <table class="table"><thead><tr><th>Type</th><th class="right">Acties</th></tr></thead>
      <tbody>
        ${types.map(t=>`<tr><td>${t.naam||t}</td><td class="right"><button class="btn btn-xs">✏️</button></td></tr>`).join('') || `<tr><td colspan="2"><em>Geen types</em></td></tr>`}
      </tbody></table>
    </div>
  `;
}
