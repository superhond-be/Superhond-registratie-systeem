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
