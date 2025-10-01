<div class="toolbar" style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
  <button id="btn-add" class="btn primary">+ Les toevoegen</button>
  <span class="muted" id="total" style="margin-left:.5rem"></span>

  <span style="flex:1 1 auto"></span>

  <button id="btn-export" class="btn">⬇︎ Export JSON</button>
  <button id="btn-agenda" class="btn">📅 Export agenda.json</button>

  <!-- ✨ NIEUW -->
  <button id="btn-reeks-gen" class="btn">♻️ Genereer uit reeks</button>

  <label class="btn">
    ⬆︎ Import JSON <input type="file" id="file-import" accept="application/json" hidden>
  </label>
  <a class="btn" href="/">→ Dashboard</a>
</div>

<!-- ✨ NIEUW: lichtgewicht modal -->
<dialog id="dlg-reeks">
  <form id="form-reeks" method="dialog" class="card" style="min-width: min(92vw, 520px)">
    <h3 style="margin-top:0">Genereer lessen uit reeks</h3>

    <div class="row">
      <label>Reeks</label>
      <select id="sel-reeks" class="input" required></select>
    </div>

    <div class="row">
      <label>Starttijd (HH:MM)</label>
      <input id="regen-start" class="input" type="time" value="10:00" required>
    </div>

    <div class="row">
      <label><input id="regen-clear" type="checkbox" checked> Bestaande lessen van deze reeks eerst verwijderen</label>
    </div>

    <menu style="display:flex;gap:.5rem;justify-content:flex-end">
      <button type="submit" class="btn primary">Genereer</button>
      <button type="button" id="regen-cancel" class="btn">Annuleren</button>
    </menu>

    <p id="regen-msg" class="muted" style="margin:.5rem 0 0"></p>
  </form>
</dialog>
