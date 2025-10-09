<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Klanten – Superhond</title>

  <!-- Centrale stijlen -->
  <link rel="stylesheet" href="../css/style.css?v=0.26.1" />
  <link rel="stylesheet" href="../css/superhond.css?v=0.26.1" />
</head>

<body class="subpage page-klanten">
  <header id="topbar" class="topbar"></header>

  <main class="container">
    <h1 class="page-title">Klanten</h1>

    <!-- Overzicht -->
    <section class="card" aria-labelledby="lijst-title">
      <div class="row" style="display:flex;gap:.5rem;align-items:center">
        <label for="search" class="sr-only">Zoeken</label>
        <input id="search" class="input" placeholder="Zoek op naam of e-mail…" aria-label="Zoeken op naam of e-mail" />
        <button id="refresh" class="btn" type="button" aria-label="Lijst verversen">🔄 Ververs</button>
      </div>

      <div id="state" class="muted" style="margin-top:.5rem" role="status" aria-live="polite">⏳ Laden…</div>

      <div class="table-wrap" style="margin-top:.5rem">
        <table class="table" id="tbl" aria-describedby="state">
          <thead>
            <tr>
              <th scope="col">Naam</th>
              <th scope="col">E-mail</th>
              <th scope="col">Telefoon</th>
              <th scope="col">Status</th>
              <th scope="col" style="width:1%;">Acties</th>
            </tr>
          </thead>
          <tbody><!-- dynamische rijen --></tbody>
        </table>
      </div>
    </section>

    <!-- Toevoegen -->
    <section class="card" style="margin-top:1rem" aria-labelledby="add-title">
      <h2 id="add-title">Nieuwe klant toevoegen</h2>

      <form id="form-add" class="form-grid" autocomplete="off" novalidate>
        <label class="sr-only" for="voornaam">Voornaam</label>
        <input id="voornaam" name="voornaam" class="input" placeholder="Voornaam" required />

        <label class="sr-only" for="achternaam">Achternaam</label>
        <input id="achternaam" name="achternaam" class="input" placeholder="Achternaam" required />

        <label class="sr-only" for="email">E-mail</label>
        <input id="email" name="email" class="input" type="email" placeholder="E-mail" inputmode="email" />

        <label class="sr-only" for="telefoon">Telefoon</label>
        <input id="telefoon" name="telefoon" class="input" placeholder="Telefoon" inputmode="tel" />

        <label class="sr-only" for="status">Status</label>
        <select id="status" name="status" class="input" aria-label="Status">
          <option value="actief" selected>actief</option>
          <option value="inactief">inactief</option>
        </select>

        <button class="btn" type="submit" aria-label="Opslaan">💾 Opslaan</button>
      </form>

      <div id="form-msg" class="muted" role="status" aria-live="polite"></div>
    </section>
  </main>

  <footer id="footer" class="footer"></footer>

  <!-- Scripts -->
  <script src="../js/layout.js?v=0.26.1" defer></script>
  <!-- klanten.js mount zelf de topbar en handelt alles af -->
  <script type="module" src="../js/klanten.js?v=0.26.1"></script>

  <noscript>
    <p style="padding:1rem;color:#b91c1c">JavaScript is vereist om deze pagina te gebruiken.</p>
  </noscript>
</body>
</html>
