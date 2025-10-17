
<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Klanten & Honden – Superhond</title>
  <meta name="superhond-exec" content="https://script.google.com/macros/s/AKfycbyxPiFzgCcMplcC5kyFgVPHcIIjDXcQoWdPMEvI2zj‑aP6ud8mG49xicSHd8SUcG22sPw/exec">

  <link rel="stylesheet" href="../css/style.css?v=0.27.6" />
  <link rel="stylesheet" href="../css/superhond.css?v=0.27.6" />
</head>

<body class="subpage page-klanten">
  <header id="topbar"></header>

  <main class="container">
    <h1 class="page-title">Klanten & Honden</h1>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab active" data-tab="klanten">🧑 Klanten</button>
      <button class="tab" data-tab="honden">🐶 Honden</button>
    </div>

    <!-- Klanten content -->
    <section id="tab-content-klanten" class="tab-panel">
      <section class="card">
        <div class="toolbar">
          <input id="search" class="input" placeholder="Zoek op naam of e-mail…" />
          <button id="refresh" class="btn" type="button">🔄 Verversen</button>
        </div>
        <div id="state" class="muted" style="margin-top:.5rem">⏳ Laden…</div>
        <div class="table-wrap" style="margin-top:.5rem">
          <table class="table" id="tbl">
            <thead>
              <tr>
                <th>Naam</th>
                <th>E-mail</th>
                <th>Telefoon</th>
                <th>Status</th>
                <th style="width:1%">Acties</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" style="margin-top:1rem">
        <h2>Nieuwe klant toevoegen</h2>
        <form id="form-add" class="form-grid" autocomplete="off">
          <input name="voornaam" class="input" placeholder="Voornaam" required />
          <input name="achternaam" class="input" placeholder="Achternaam" required />
          <input name="email" class="input" type="email" placeholder="E-mail" />
          <input name="telefoon" class="input" placeholder="Telefoon" />
          <select name="status" class="input">
            <option value="actief" selected>actief</option>
            <option value="inactief">inactief</option>
          </select>
          <button class="btn primary" type="submit">💾 Opslaan</button>
        </form>
        <div id="form-msg" class="muted" role="status" aria-live="polite"></div>
      </section>
    </section>

    <!-- Honden content -->
    <section id="tab-content-honden" class="tab-panel" style="display:none">
      <section class="card">
        <div class="toolbar">
          <input id="search-hond" class="input" placeholder="Zoek op naam of chip…" />
          <button id="refresh-hond" class="btn" type="button">🔄 Verversen</button>
        </div>
        <div id="state-hond" class="muted" style="margin-top:.5rem">⏳ Laden…</div>
        <div class="table-wrap" style="margin-top:.5rem">
          <table class="table" id="tbl-hond">
            <thead>
              <tr>
                <th>Naam</th>
                <th>Ras</th>
                <th>Geboortedatum</th>
                <th>Eigenaar (id)</th>
                <th style="width:1%">Acties</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="card" style="margin-top:1rem">
        <h2>Nieuwe hond toevoegen</h2>
        <form id="form-add-hond" class="form-grid" autocomplete="off">
          <input name="name" class="input" placeholder="Naam" required />
          <input name="breed" class="input" placeholder="Ras" />
          <input name="birthdate" class="input" type="date" />
          <input name="ownerId" class="input" placeholder="Eigenaar (id)" required />
          <input name="chip" class="input" placeholder="Chipnummer" />
          <input name="notes" class="input" placeholder="Notities" />
          <select name="status" class="input">
            <option value="actief" selected>actief</option>
            <option value="inactief">inactief</option>
          </select>
          <button class="btn primary" type="submit">💾 Opslaan</button>
        </form>
        <div id="form-msg-hond" class="muted" role="status" aria-live="polite"></div>
      </section>
    </section>

  </main>

  <footer id="footer"></footer>

  <script type="module">
    import { SuperhondUI } from '../js/layout.js';
    import '../js/klanten.js?v=0.27.6';
    import { initHondenTab } from '../js/honden-tab.js?v=0.27.6';

    SuperhondUI.mount({
      title: 'Klanten & Honden',
      icon: '🐾',
      back: '../dashboard/',
      home: false
    });

    let hondenIngeladen = false;
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        const selected = tab.dataset.tab;
        console.log('[TABS] selected =', selected);

        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');

        tab.classList.add('active');
        document.getElementById(`tab-content-${selected}`).style.display = '';

        if (selected === 'honden' && !hondenIngeladen) {
          console.log('[TABS] initializing honden tab');
          await initHondenTab();
          hondenIngeladen = true;
          console.log('[TABS] honden tab initialized');
        }
      });
    });
  </script>

  <noscript><p style="padding:1rem;color:#b91c1c">JavaScript is vereist.</p></noscript>
</body>
</html>
