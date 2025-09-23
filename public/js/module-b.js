// v1.3 - Module B dynamic table
let rows = [];
const tbody = () => document.getElementById('tbody');

function render(list){
  tbody().innerHTML = list.map(k => `
    <tr data-id="${k.id}">
      <td>${k.naam}</td>
      <td>${k.hond.naam}</td>
      <td>${k.hond.ras}</td>
      <td>${k.hond.leeftijd}</td>
      <td>
        <button class="action edit" title="Bewerken">✏️</button>
        <button class="action save" title="Opslaan">💾</button>
        <button class="action delete" title="Verwijderen">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function attachActions(){
  tbody().querySelectorAll('tr').forEach(tr => {
    tr.querySelector('.edit').onclick = () => {
      tr.querySelectorAll('td').forEach((td,i)=>{
        if(i<4){
          const val = td.textContent;
          td.innerHTML = `<input value="${val}" />`;
        }
      });
    };
    tr.querySelector('.save').onclick = () => {
      const id = parseInt(tr.dataset.id);
      const inputs = tr.querySelectorAll('input');
      if(inputs.length===4){
        const [naam,hond,ras,leeftijd] = Array.from(inputs).map(i=>i.value);
        const idx = rows.findIndex(r=>r.id===id);
        if(idx>-1){
          rows[idx].naam = naam;
          rows[idx].hond.naam = hond;
          rows[idx].hond.ras = ras;
          rows[idx].hond.leeftijd = parseInt(leeftijd)||rows[idx].hond.leeftijd;
          render(rows); attachActions();
        }
      }
    };
    tr.querySelector('.delete').onclick = () => {
      const id = parseInt(tr.dataset.id);
      rows = rows.filter(r=>r.id!==id);
      render(rows); attachActions();
    };
  });
}

function addRow(){
  const maxId = rows.reduce((m,r)=>Math.max(m,r.id),0)+1;
  rows.push({id:maxId, naam:'Nieuwe klant', hond:{naam:'Nieuwe hond', ras:'', leeftijd:1}});
  render(rows); attachActions();
}

document.addEventListener('DOMContentLoaded', () => {
  fetch('./data/seed.json').then(r=>r.json()).then(data=>{
    rows = data.klanten || [];
    render(rows); attachActions();
  });

  document.getElementById('addRow').onclick = addRow;
  document.getElementById('search').addEventListener('input', (e)=>{
    const q = e.target.value.toLowerCase();
    const filtered = rows.filter(k => (k.naam+' '+k.hond.naam+' '+k.hond.ras).toLowerCase().includes(q));
    render(filtered); attachActions();
  });
});
