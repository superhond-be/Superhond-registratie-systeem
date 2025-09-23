# Superhond – Klanten & Honden (V1.2)

Deze bundel bevat een minimale, werkende demo voor het beheren van **klanten** en hun **honden**, met **NL/BE**-specifieke adres- en telefoonvalidatie.

## Inhoud
- `index.html` — formulier + demo-output
- `public/css/style.css` — Superhond-stijl
- `public/js/app.js` — postcode/telefoon normalisatie & hondenbeheer (client-side)
- `server/schema.sql` — database-tabellen (klanten, honden, landen)

## Testen
Open `index.html` in je browser. Gebruik de knop **⚡ Prefill demo** voor snel testen.
De **Opslaan (demo)** knop toont de JSON-payload (alsof die naar je backend gaat).

## Integratie-notes
- Sla telefoonnummers **altijd** op in E.164 (kolommen `tel_e164`, `tel2_e164`).
- Toon in de UI desgewenst het nationale formaat (client-side helper zit in `app.js`).
- Voor echte opslag: POST `payload` uit `app.js` naar je API (bijv. `/api/klanten`).

Veel succes! 🐶
