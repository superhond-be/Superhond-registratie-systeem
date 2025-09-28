# 🐶 Superhond Registratie Systeem

## 📂 Structuur
- **/public** → frontend (HTML, CSS, JS)
- **/server** → backend (Express API)
- **/db** → database schema's & seeddata
- **package.json** → versiebeheer + scripts

---

## 🚀 Workflow: GitHub → Render → Live

### 1. Code aanpassen
- Maak wijzigingen in frontend of backend.
- Update versienummer in `package.json` (bv. `0.18.6`).

### 2. Commit & push naar GitHub
```bash
git add .
git commit -m "Update klanten API + versie 0.18.6"
git push origin main

public/
  index.html
  klanten/index.html
  honden/index.html
  ui/
    style.css
    layout.js
  data/
    klanten.json
    honden.json
  version.json
tools/
  bump-version.js
  verify.js
package.json

npm run bump         # patch
npm run bump:minor   # minor
npm run bump:major   # major
git push

<link rel="stylesheet" href="/ui/style.css?v=0.18.9">
<script src="/ui/layout.js?v=0.18.9"></script>
<script>
  const isK = location.pathname.includes('/klanten');
  const isH = location.pathname.includes('/honden');
  SuperhondUI.mount({
    title: isK ? 'Klanten' : (isH ? 'Honden' : 'Superhond Registratie'),
    icon:  isK ? '👤'      : (isH ? '🐶'    : '🐾'),
    home:  !isK && !isH,
    back:  '/'
  });
</script>

