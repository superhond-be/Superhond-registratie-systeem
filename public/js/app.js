
const form = document.querySelector('#klantForm');
const dogsList = document.querySelector('#dogsList');
const out = document.querySelector('#output');
const btnAddDog = document.querySelector('#addDog');
const btnSave = document.querySelector('#saveBtn');
const btnReset = document.querySelector('#resetBtn');

const elLand = document.querySelector('#land');
const elPostcode = document.querySelector('#postcode');
const elTel = document.querySelector('#tel');
const elTel2 = document.querySelector('#tel2');

let dogCount = 0;

/* ---------- Helpers ---------- */
const onlyDigits = s => (s||'').replace(/[^\d]/g,'');

function normalizePostcode(value, land) {
  if (!value) return '';
  value = value.trim();
  if (land === 'BE') {
    return onlyDigits(value).slice(0,4);
  }
  if (land === 'NL') {
    const digits = onlyDigits(value).slice(0,4);
    const letters = value.replace(/[^A-Za-z]/g,'').toUpperCase().slice(0,2);
    return (digits + (letters ? ' ' + letters : '')).trim();
  }
  return value;
}

function validatePostcode(value, land) {
  if (land === 'BE') return /^[1-9][0-9]{3}$/.test(value);
  if (land === 'NL') return /^[1-9][0-9]{3}\s?[A-Za-z]{2}$/.test(value);
  return true;
}

function normalizePhoneToE164(input, land) {
  if (!input) return '';
  let s = input.replace(/[^\d+]/g,'');
  if (s.startsWith('+')) {
    return '+' + s.slice(1).replace(/[^\d]/g,'');
  }
  if (s.startsWith('00')) {
    return '+' + s.slice(2).replace(/[^\d]/g,'');
  }
  const map = { BE: '+32', NL: '+31' };
  const cc = map[land] || '';
  if (s.startsWith('0')) return cc + s.slice(1);
  return (cc || '+') + s;
}

function friendlyNational(e164, land) {
  if (!e164) return '';
  let d = e164.replace(/[^\d]/g,'');
  if (land === 'BE' && d.startsWith('32')) {
    d = '0' + d.slice(2);
    return d.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/,'$1 $2 $3 $4');
  }
  if (land === 'NL' && d.startsWith('31')) {
    d = '0' + d.slice(2);
    if (d.startsWith('06')) return d.replace(/(\d{2})(\d{4})(\d{4})/,'$1-$2 $3');
    return d;
  }
  return e164;
}

function mark(el, ok){ el.classList.toggle('invalid', !ok); return ok; }

/* ---------- Dogs UI ---------- */
btnAddDog.onclick = ()=>{
  const card = document.createElement('div');
  card.className = 'dog-card';
  card.innerHTML = `
    <div class="dog-grid">
      <label>Naam <input name="hond_naam_${dogCount}" required></label>
      <label>Ras <input name="hond_ras_${dogCount}"></label>
      <label>Geboorte <input type="date" name="hond_geboorte_${dogCount}"></label>
      <label>Opmerkingen <input name="hond_note_${dogCount}"></label>
    </div>
  `;
  dogsList.appendChild(card);
  dogCount++;
};

/* ---------- Reactive formatting ---------- */
elLand.addEventListener('change', ()=>{
  elPostcode.value = normalizePostcode(elPostcode.value, elLand.value);
  mark(elPostcode, validatePostcode(elPostcode.value, elLand.value));
  elTel.value = normalizePhoneToE164(elTel.value, elLand.value);
  elTel2.value = normalizePhoneToE164(elTel2.value, elLand.value);
});

elPostcode.addEventListener('blur', ()=>{
  elPostcode.value = normalizePostcode(elPostcode.value, elLand.value);
  mark(elPostcode, validatePostcode(elPostcode.value, elLand.value));
});

[elTel, elTel2].forEach(inp=>{
  if(!inp) return;
  inp.addEventListener('blur', ()=>{
    inp.value = normalizePhoneToE164(inp.value, elLand.value);
  });
});

/* ---------- Save (demo) ---------- */
btnSave.onclick = ()=>{
  const fd = Object.fromEntries(new FormData(form).entries());
  const land = fd.land || 'BE';

  // Validate fields
  const pc = normalizePostcode(fd.postcode || '', land);
  fd.postcode = pc;
  const pcOk = validatePostcode(pc, land);
  mark(elPostcode, pcOk);

  // Phones
  const tel1 = normalizePhoneToE164(fd.tel||'', land);
  const tel2 = normalizePhoneToE164(fd.tel2||'', land);
  fd.tel_e164 = tel1 || null;
  fd.tel2_e164 = tel2 || null;
  fd.tel_view = friendlyNational(tel1, land);
  fd.tel2_view = friendlyNational(tel2, land);
  delete fd.tel; delete fd.tel2;

  if (!pcOk) {
    alert('Controleer de postcode (' + (land==='BE'?'België':'Nederland') + ').');
    return;
  }

  // Dogs
  const dogs = [];
  for(let i=0;i<dogCount;i++){
    dogs.push({
      naam: fd[`hond_naam_${i}`]||'',
      ras: fd[`hond_ras_${i}`]||'',
      geboortedatum: fd[`hond_geboorte_${i}`]||'',
      note: fd[`hond_note_${i}`]||''
    });
    delete fd[`hond_naam_${i}`];
    delete fd[`hond_ras_${i}`];
    delete fd[`hond_geboorte_${i}`];
    delete fd[`hond_note_${i}`];
  }

  const payload = { klant: fd, honden: dogs };
  out.textContent = JSON.stringify(payload, null, 2);
  alert('Demo: gegevens gevalideerd en verzameld. Zie Resultaat.');
};

/* ---------- Reset ---------- */
btnReset.onclick = ()=>{
  form.reset(); dogsList.innerHTML = ''; out.textContent = 'Nog geen data…'; dogCount = 0;
};
