// honden-tab.js — gebruikt binnen klanten/honden-tab weergave
export function initHondenTab(){
  const $ = (sel) => document.querySelector(sel);
  const tblBody = $('#tab-content-honden #tbl tbody');
  const state = $('#tab-content-honden #state');
  const form = $('#tab-content-honden #form-add');
  const formMsg = $('#tab-content-honden #form-msg');

  async function fetchHonden(){
    try {
      state.textContent = '⏳ Laden…';
      const res = await fetch('../data/honden.json'); // ← aanpassen indien Sheets
      const data = await res.json();
      renderTabel(data);
      state.textContent = '';
    } catch(e){
      state.textContent = '⚠️ Fout bij laden';
      console.error('Fout bij laden honden:', e);
    }
  }

  function renderTabel(honden){
    tblBody.innerHTML = '';
    honden.forEach(hond => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${hond.name || ''}</td>
        <td>${hond.breed || ''}</td>
        <td>${hond.birthdate || ''}</td>
        <td>${hond.ownerId || ''}</td>
        <td><button class="btn-xs">✏️</button></td>
      `;
      tblBody.appendChild(tr);
    });
  }

  // Formulier submit
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    console.log('Nieuwe hond:', data); // hier komt later opslag
    formMsg.textContent = '💾 Hond opgeslagen (lokaal)';
    form.reset();
  });

  fetchHonden();
}
