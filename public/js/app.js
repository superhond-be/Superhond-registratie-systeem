// 🔨🤖🔧 Klanten & Honden beheer (localStorage, geen backend)

// Storage keys
const LS_KEYS = {
  customers: 'KH_CUSTOMERS',
  dogs: 'KH_DOGS',
  seq: 'KH_SEQ'
};

// State
let customers = [];
let dogs = [];
let seq = 1;

// DOM refs
const el = (id) => document.getElementById(id);

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  bindEvents();
  renderAll();
});

// --- State management ---
function loadState() {
  customers = JSON.parse(localStorage.getItem(LS_KEYS.customers) || '[]');
  dogs = JSON.parse(localStorage.getItem(LS_KEYS.dogs) || '[]');
  seq = Number(localStorage.getItem(LS_KEYS.seq) || '1');
}

function saveState() {
  localStorage.setItem(LS_KEYS.customers, JSON.stringify(customers));
  localStorage.setItem(LS_KEYS.dogs, JSON.stringify(dogs));
  localStorage.setItem(LS_KEYS.seq, String(seq));
}

// --- Utils ---
function nextId() { return seq++; }
function byId(id) { return (x) => x.id === id; }
function formatAddress(c) {
  const parts = [c.street, c.postcode, c.city].filter(Boolean);
  return parts.join(', ');
}
function getDogsByCustomerId(customerId) {
  return dogs.filter(d => d.customerId === customerId);
}
function sortByName(a,b) {
  return a.name.localeCompare(b.name, 'nl', {sensitivity:'base'});
}

// --- Bind events ---
function bindEvents() {
  // Customer form
  el('customerForm').addEventListener('submit', onSaveCustomer);
  el('resetCustomer').addEventListener('click', () => fillCustomerForm());

  // Dog form
  el('dogForm').addEventListener('submit', onSaveDog);
  el('resetDog').addEventListener('click', () => fillDogForm());

  // Toolbar
  el('searchInput').addEventListener('input', renderCustomerList);
  el('clearSearch').addEventListener('click', () => { el('searchInput').value=''; renderCustomerList(); });

  el('exportBtn').addEventListener('click', onExport);
  el('importInput').addEventListener('change', onImport);
  el('wipeBtn').addEventListener('click', onWipeAll);

  el('demoDataBtn').addEventListener('click', seedDemoData);
}

// --- Handlers: Customer ---
function onSaveCustomer(e) {
  e.preventDefault();
  const id = Number(el('customerId').value || 0);
  const payload = {
    name: el('customerName').value.trim(),
    phone: el('customerPhone').value.trim(),
    email: el('customerEmail').value.trim(),
    notes: el('customerNotes').value.trim(),
    street: el('customerStreet').value.trim(),
    postcode: el('customerPostcode').value.trim(),
    city: el('customerCity').value.trim()
  };
  if (!payload.name) {
    alert('Naam is verplicht.');
    return;
  }
  if (id) {
    const idx = customers.findIndex(byId(id));
    if (idx >= 0) customers[idx] = { ...customers[idx], ...payload };
  } else {
    customers.push({ id: nextId(), ...payload });
  }
  saveState();
  renderAll();
  fillCustomerForm(); // reset
}

function editCustomer(id) {
  const c = customers.find(byId(id));
  if (!c) return;
  fillCustomerForm(c);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteCustomer(id) {
  const c = customers.find(byId(id));
  if (!c) return;
  const childCount = getDogsByCustomerId(id).length;
  const ok = confirm(`Klant "${c.name}" verwijderen? Dit verwijdert ook ${childCount} hond(en).`);
  if (!ok) return;
  customers = customers.filter(x => x.id !== id);
  dogs = dogs.filter(d => d.customerId !== id);
  saveState();
  renderAll();
}

// --- Customer form populate/reset ---
function fillCustomerForm(c = null) {
  el('customerId').value = c?.id || '';
  el('customerName').value = c?.name || '';
  el('customerPhone').value = c?.phone || '';
  el('customerEmail').value = c?.email || '';
  el('customerNotes').value = c?.notes || '';
  el('customerStreet').value = c?.street || '';
  el('customerPostcode').value = c?.postcode || '';
  el('customerCity').value = c?.city || '';
}

// --- Handlers: Dog ---
function onSaveDog(e) {
  e.preventDefault();
  const id = Number(el('dogId').value || 0);
  const customerId = Number(el('dogOwner').value);
  const payload = {
    customerId,
    name: el('dogName').value.trim(),
    breed: el('dogBreed').value.trim(),
    age: Number(el('dogAge').value || 0),
    notes: el('dogNotes').value.trim()
  };
  if (!payload.customerId || !payload.name) {
    alert('Klant en Naam zijn verplicht voor een hond.');
    return;
  }
  if (id) {
    const idx = dogs.findIndex(byId(id));
    if (idx >= 0) dogs[idx] = { ...dogs[idx], ...payload };
  } else {
    dogs.push({ id: nextId(), ...payload });
  }
  saveState();
  renderAll();
  fillDogForm();
}

function editDog(id) {
  const d = dogs.find(byId(id));
  if (!d) return;
  fillDogForm(d);
  // scroll to dog form
  document.getElementById('hdr-hond').scrollIntoView({behavior:'smooth', block:'start'});
}

function deleteDog(id) {
  const d = dogs.find(byId(id));
  if (!d) return;
  const owner = customers.find(byId(d.customerId));
  const ok = confirm(`Hond "${d.name}" van "${owner?.name || 'onbekend'}" verwijderen?`);
  if (!ok) return;
  dogs = dogs.filter(x => x.id !== id);
  saveState();
  renderAll();
}

// --- Dog form populate/reset ---
function fillDogForm(d = null) {
  ensureOwnerOptions();
  el('dogId').value = d?.id || '';
  el('dogOwner').value = d?.customerId || '';
  el('dogName').value = d?.name || '';
  el('dogBreed').value = d?.breed || '';
  el('dogAge').value = d?.age ?? '';
  el('dogNotes').value = d?.notes || '';
}

// --- Owner dropdown ---
function ensureOwnerOptions() {
  const sel = el('dogOwner');
  const current = sel.value;
  sel.innerHTML = '';
  const def = document.createElement('option');
  def.value = '';
  def.textContent = '— kies klant —';
  sel.appendChild(def);
  customers.slice().sort(sortByName).forEach(c => {
    const o = document.createElement('option');
    o.value = String(c.id);
    o.textContent = c.name;
    sel.appendChild(o);
  });
  if (current) sel.value = current;
}

// --- Rendering ---
function renderAll() {
  ensureOwnerOptions();
  renderCustomerList();
  renderStats();
  renderKPIs();
}

function renderCustomerList() {
  const q = el('searchInput').value.trim().toLowerCase();
  const list = el('customerList');
  list.innerHTML = '';

  if (customers.length === 0) {
    list.innerHTML = `<div class="empty">Nog geen klanten toegevoegd.</div>`;
    return;
  }

  const items = customers
    .slice()
    .sort(sortByName)
    .filter(c => {
      if (!q) return true;
      const fields = [
        c.name, c.phone, c.email, c.notes, c.street, c.postcode, c.city
      ].filter(Boolean).join(' ').toLowerCase();
      const hasCustomer = fields.includes(q);
      const hasAnyDog = getDogsByCustomerId(c.id).some(d => {
        const df = [d.name, d.breed, d.notes].filter(Boolean).join(' ').toLowerCase();
        return df.includes(q);
      });
      return hasCustomer || hasAnyDog;
    });

  if (items.length === 0) {
    list.innerHTML = `<div class="empty">Geen resultaten voor “${q}”.</div>`;
    return;
  }

  items.forEach(c => {
    const div = document.createElement('div');
    div.className = 'item';

    const dogItems = getDogsByCustomerId(c.id).sort(sortByName);

    div.innerHTML = `
      <div>
        <h3>${escapeHtml(c.name)}</h3>
        <div class="muted">
          ${escapeHtml(formatAddress(c) || '—')}
        </div>
        <div class="muted">
          ${c.phone ? `📞 ${escapeHtml(c.phone)} ` : ''} 
          ${c.email ? `· ✉️ ${escapeHtml(c.email)}` : ''}
        </div>
        ${c.notes ? `<div class="muted">📝 ${escapeHtml(c.notes)}</div>` : ''}
        <div class="dog-list">
          ${dogItems.length ? dogItems.map(d => `
            <span class="tag">
              🐶 ${escapeHtml(d.name)}${d.breed?` (${escapeHtml(d.breed)})`:''}
              <button data-edit-dog="${d.id}" title="Bewerken">✎</button>
              <button data-del-dog="${d.id}" title="Verwijderen">🗑</button>
            </span>
          `).join('') : `<span class="tag">Geen honden</span>`}
        </div>
      </div>
      <div class="right">
        <button class="btn ghost" data-add-dog-for="${c.id}">+ Hond</button>
        <button class="btn" data-edit-customer="${c.id}">✎</button>
        <button class="btn danger" data-del-customer="${c.id}">🗑</button>
      </div>
    `;

    list.appendChild(div);
  });

  // Delegate buttons
  list.querySelectorAll('[data-edit-customer]').forEach(btn =>
    btn.addEventListener('click', () => editCustomer(Number(btn.dataset.editCustomer))));
  list.querySelectorAll('[data-del-customer]').forEach(btn =>
    btn.addEventListener('click', () => deleteCustomer(Number(btn.dataset.delCustomer))));
  list.querySelectorAll('[data-add-dog-for]').forEach(btn =>
    btn.addEventListener('click', () => {
      fillDogForm({ customerId: Number(btn.dataset.addDogFor) });
      document.getElementById('hdr-hond').scrollIntoView({behavior:'smooth', block:'start'});
    }));
  list.querySelectorAll('[data-edit-dog]').forEach(btn =>
    btn.addEventListener('click', () => editDog(Number(btn.dataset.editDog))));
  list.querySelectorAll('[data-del-dog]').forEach(btn =>
    btn.addEventListener('click', () => deleteDog(Number(btn.dataset.delDog))));
}

function renderStats() {
  const c = customers.length;
  const d = dogs.length;
  const avg = c ? (d / c).toFixed(2) : '0';
  el('statCustomers').textContent = `Klanten: ${c}`;
  el('statDogs').textContent = `Honden: ${d}`;
  el('statAvg').textContent = `Gem./klant: ${avg}`;
}

function renderKPIs() {
  if (customers.length === 0) {
    el('kpiMostDogs').textContent = 'Meeste honden: –';
    el('kpiNoDogs').textContent = 'Klanten zonder hond: –';
    return;
  }
  let max = 0, maxNames = [];
  let noDogs = 0;
  customers.forEach(c => {
    const count = getDogsByCustomerId(c.id).length;
    if (count === 0) noDogs++;
    if (count > max) { max = count; maxNames = [c.name]; }
    else if (count === max) { maxNames.push(c.name); }
  });
  el('kpiMostDogs').textContent = max === 0
    ? 'Meeste honden: 0'
    : `Meeste honden: ${max} (${maxNames.join(', ')})`;
  el('kpiNoDogs').textContent = `Klanten zonder hond: ${noDogs}`;
}

// --- Export / Import / Wipe ---
function onExport() {
  const data = { customers, dogs, seq };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `klanten-honden-export-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function onImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.customers) || !Array.isArray(data.dogs)) {
        alert('Ongeldige importstructuur.');
        return;
      }
      customers = data.customers;
      dogs = data.dogs;
      seq = Number(data.seq || Math.max(1,
        ...customers.map(c=>c.id), ...dogs.map(d=>d.id))) + 1;
      saveState();
      renderAll();
      alert('Import succesvol! ✔️');
    } catch (err) {
      console.error(err);
      alert('Kon het JSON-bestand niet lezen.');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

function onWipeAll() {
  if (!confirm('Weet je zeker dat je ALLE gegevens wilt wissen?')) return;
  customers = [];
  dogs = [];
  seq = 1;
  saveState();
  renderAll();
}

// --- Demo data ---
function seedDemoData() {
  if (customers.length || dogs.length) {
    if (!confirm('Bestaande data blijft staan. Demo-data toevoegen?')) return;
  }
  const c1 = { id: nextId(), name: 'Jan Jansen', phone: '0612345678', email: 'jan@example.com', notes:'Avondlessen', street:'Lindelaan 12', postcode:'1234 AB', city:'Amsterdam' };
  const c2 = { id: nextId(), name: 'Piet Pieters', phone: '', email: 'piet@voorbeeld.nl', notes:'', street:'Dorpsstraat 7', postcode:'5678 CD', city:'Utrecht' };
  const c3 = { id: nextId(), name: 'Sanne de Vries', phone: '0622334455', email: '', notes:'Bang voor grote honden', street:'Kerkweg 2', postcode:'9012 EF', city:'Haarlem' };
  customers.push(c1, c2, c3);

  dogs.push(
    { id: nextId(), customerId: c1.id, name:'Bobby', breed:'Labrador', age:3, notes:'Energiek' },
    { id: nextId(), customerId: c1.id, name:'Max', breed:'Beagle', age:2, notes:'' },
    { id: nextId(), customerId: c2.id, name:'Luna', breed:'Border Collie', age:4, notes:'Slimme dame' }
  );
  saveState();
  renderAll();
}

// --- Security: escape ---
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
