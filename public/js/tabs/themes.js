export async function render(host, state){
  const themas = state.themas || [];
  host.innerHTML = `
    <div class="toolbar"><button class="btn primary">+ Thema</button></div>
    <div class="table-wrap" style="margin-top:.5rem">
      <table class="table"><thead><tr><th>Thema</th><th class="right">Acties</th></tr></thead>
      <tbody>
        ${themas.map(t=>`<tr><td>${t.naam||t}</td><td class="right"><button class="btn btn-xs">✏️</button></td></tr>`).join('') || `<tr><td colspan="2"><em>Geen thema’s</em></td></tr>`}
      </tbody></table>
    </div>
  `;
}
