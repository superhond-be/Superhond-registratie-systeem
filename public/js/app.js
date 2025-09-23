
/* Superhond V1.2 – Klanten & Honden (NL/BE) */
const elForm = document.querySelector('#klantForm');
const elLand = document.querySelector('#land');
const elPostcode = document.querySelector('#postcode');
const elTel = document.querySelector('#tel');
const elTel2 = document.querySelector('#tel2');
const elDogs = document.querySelector('#hondenList');
const elAddDog = document.querySelector('#addHond');
const elOutput = document.querySelector('#output');
const elPrefill = document.querySelector('#prefill');

/* ---- Helpers ---- */
const onlyDigits = s => s.replace(/[^\d]/g, '');
const trimSpaces = s => (s || '').trim();

function normalizePostcode(value, land) {
  if (!value) return value;
  value = value.trim();
  if (land === 'BE') {
    // BE: 4 digits, no space
    const digits = onlyDigits(value);
    return digits.slice(0,4);
  }
  if (land === 'NL') {
    // NL: 4 digits + 2 letters, format "1234 AB"
    const digits = onlyDigits(value).slice(0,4);
    const letters = (value.replace(/[^A-Za-z]/g,'').toUpperCase()).slice(0,2);
    if (digits.length === 4 && letters.length === 2) {
      return `${digits} ${letters}`;
    }
    // Partial as-you-type – return what we have
    return (digits + (letters ? ' ' + letters : '')).trim();
  }
  return value;
}

function validatePostcode(value, land) {
  if (land === 'BE') {
    return /^[1-9][0-9]{3}$/.test(value);
  }
  if (land === 'NL') {
    return /^[1-9][0-9]{3}\s?[A-Za-z]{2}$/.test(value);
  }
  return true;
}

function normalizePhoneToE164(input, land) {
  if (!input) return '';
  let s = input.replace(/[^\d+]/g, '');

  // Already E.164-like
  if (s.startsWith('+')) {
    // Keep plus, strip remaining non-digits
    const rest = s.slice(1).replace(/[^\d]/g, '');
    return '+' + rest;
  }

  // Leading 00 international prefix -> +..
  if (s.startsWith('00')) {
    return '+' + s.slice(2);
  }

  // National numbers: replace leading 0 by country code
  const map = { BE: '+32', NL: '+31' };
  const cc = map[land] || '';
  if (s.startsWith('0') && cc) {
    return cc + s.slice(1);
  }

  // If user typed digits without 0/+, assume country code
  return (map[land] || '+') + s;
}

function friendlyNationalFormat(e164, land) {
  // super light formatter just for demo preview
  if (!e164) return '';
  let d = e164.replace(/[^\d]/g, '');
  if (land === 'BE' && d.startsWith('32')) {
    d = '0' + d.slice(2);
    // try spacing 04xx xx xx xx or 03/...
    return d.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
  }
  if (land === 'NL' && d.startsWith('31')) {
    d = '0' + d.slice(2);
    // 06-xxxx xxxx
    if (d.startsWith('06')) {
      return d.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2 $3');
    }
    return d;
  }
  return e164;
}

/* ---- Dogs UI ---- */
let dogCounter = 0;
function dogTemplate(id) {
  return `
  <div class="dog-card" data-dog-id="${id}">
    <div class="dog-grid">
      <label>Naam
        <input name="hond_naam_${id}" required>
      </label>
      <label>Ras
        <input name="hond_ras_${id}">
      </label>
      <label>Geboortedatum
        <input type="date" name="hond_geboorte_${id}">
      </label>
      <label>Opmerkingen
        <input name="hond_opm_${id}">
      </label>
    </div>
    <div class="dog-actions">
      <button type="button" class="btn danger" data-remove="${id}">🗑️ Verwijder hond</button>
    </div>
  </div>`;
}

function addDog(prefill=null) {
  const id = ++dogCounter;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = dogTemplate(id);
  const node = wrapper.firstElementChild;
  elDogs.appendChild(node);
  if (prefill) {
    node.querySelector(`[name="hond_naam_${id}"]`).value = prefill.naam || '';
    node.querySelector(`[name="hond_ras_${id}"]`).value = prefill.ras || '';
    node.querySelector(`[name="hond_geboorte_${id}"]`).value = prefill.geboortedatum || '';
    node.querySelector(`[name="hond_opm_${id}"]`).value = prefill.opmerkingen || '';
  }
  node.querySelector('[data-remove]').addEventListener('click', () => {
    node.remove();
  });
}

elAddDog.addEventListener('click', () => addDog());

/* ---- Reactive normalizers ---- */
elLand.addEventListener('change', () => {
  elPostcode.value = normalizePostcode(elPostcode.value, elLand.value);
  // Re-validate
  validateField(elPostcode, validatePostcode(elPostcode.value, elLand.value));
  // Normalize phones
  if (elTel.value) elTel.value = normalizePhoneToE164(elTel.value, elLand.value);
  if (elTel2.value) elTel2.value = normalizePhoneToE164(elTel2.value, elLand.value);
});

elPostcode.addEventListener('blur', () => {
  const val = normalizePostcode(elPostcode.value, elLand.value);
  elPostcode.value = val;
  validateField(elPostcode, validatePostcode(val, elLand.value));
});

function validateField(input, ok) {
  input.classList.toggle('invalid', !ok);
  return ok;
}

/* ---- Submit (demo) ---- */
elForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const land = elLand.value;
  const data = Object.fromEntries(new FormData(elForm).entries());

  // Normalize phone(s) to E.164
  const telE164 = normalizePhoneToE164(data.tel || '', land);
  const tel2E164 = normalizePhoneToE164(data.tel2 || '', land);

  // Validate postcode
  const pcOk = validatePostcode(data.postcode, land);
  validateField(elPostcode, pcOk);
  if (!pcOk) {
    alert('Controleer de postcode voor ' + (land === 'BE' ? 'België' : 'Nederland') + '.');
    return;
  }

  // Collect dogs
  const dogs = Array.from(document.querySelectorAll('.dog-card')).map(card => {
    const id = card.getAttribute('data-dog-id');
    return {
      naam: trimSpaces(card.querySelector(`[name="hond_naam_${id}"]`).value),
      ras: trimSpaces(card.querySelector(`[name="hond_ras_${id}"]`).value),
      geboortedatum: trimSpaces(card.querySelector(`[name="hond_geboorte_${id}"]`).value),
      opmerkingen: trimSpaces(card.querySelector(`[name="hond_opm_${id}"]`).value),
    };
  });

  const payload = {
    klant: {
      voornaam: trimSpaces(data.voornaam),
      achternaam: trimSpaces(data.achternaam),
      email: trimSpaces(data.email),
      land,
      straat: trimSpaces(data.straat),
      huisnummer: trimSpaces(data.huisnummer),
      toevoeging: trimSpaces(data.toevoeging),
      postcode: trimSpaces(normalizePostcode(data.postcode, land)),
      plaats: trimSpaces(data.plaats),
      tel_e164: telE164 || null,
      tel2_e164: tel2E164 || null,
      tel_nationaal: friendlyNationalFormat(telE164, land),
      tel2_nationaal: friendlyNationalFormat(tel2E164, land),
      opmerkingen: trimSpaces(data.opmerkingen),
    },
    honden: dogs
  };

  elOutput.textContent = JSON.stringify(payload, null, 2);
  console.log('Demo payload →', payload);
  alert('Demo: gegevens verzameld. Zie Resultaat.');
});

/* ---- Prefill demo ---- */
elPrefill.addEventListener('click', () => {
  const demo = {
    klant: {
      voornaam: 'Jan',
      achternaam: 'Janssens',
      email: 'jan.janssens@example.com',
      land: 'BE',
      straat: 'Kerkstraat',
      huisnummer: '12',
      toevoeging: 'bus 2',
      postcode: '2000',
      plaats: 'Antwerpen',
      tel: '0470 12 34 56',
      tel2: ''
    },
    honden: [
      { naam: 'Rocco', ras: 'Mechelse herder', geboortedatum: '2021-06-15', opmerkingen: 'Energiek' },
      { naam: 'Luna', ras: 'Labrador', geboortedatum: '2019-03-09', opmerkingen: '' }
    ]
  };

  elForm.reset();
  elLand.value = demo.klant.land;
  document.querySelector('[name="voornaam"]').value = demo.klant.voornaam;
  document.querySelector('[name="achternaam"]').value = demo.klant.achternaam;
  document.querySelector('[name="email"]').value = demo.klant.email;
  document.querySelector('[name="straat"]').value = demo.klant.straat;
  document.querySelector('[name="huisnummer"]').value = demo.klant.huisnummer;
  document.querySelector('[name="toevoeging"]').value = demo.klant.toevoeging;
  document.querySelector('[name="postcode"]').value = normalizePostcode(demo.klant.postcode, demo.klant.land);
  document.querySelector('[name="plaats"]').value = demo.klant.plaats;
  document.querySelector('[name="tel"]').value = normalizePhoneToE164(demo.klant.tel, demo.klant.land);

  // Reset dogs list
  elDogs.innerHTML = '';
  demo.honden.forEach(h => addDog(h));
});

// Add one empty dog by default for convenience
addDog();
