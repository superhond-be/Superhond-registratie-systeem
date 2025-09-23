# Superhond – Version Sync Patch v1.3

Doel: zorg dat de UI **altijd** de juiste versie toont en voorkom caching-issues.

## Stap 1 — Voeg in je HTML toe
```html
<link rel="stylesheet" href="./public/css/style.css" data-bust>
<span class="version-badge" data-version>v1.2</span>
<small class="build" data-build></small>
<script src="./public/js/version.js" defer></script>
```

## Stap 2 — Plaats deze bestanden
- `public/version.json`
- `public/js/version.js`

Bij deploy zal `version.js` `version.json` ophalen en alle elementen met `data-version`
updaten naar **v1.3** en tegelijk je CSS/JS URL’s cache-busten met `?v=v1.3`.

> Tip: Update bij elke release alleen `public/version.json`.
