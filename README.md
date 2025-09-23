
# Superhond Chat Starter (Node + SQLite + Minimal Frontend)

Een kleine, **veilige** starter waarmee jij rechtstreeks met een GPT-model kan praten via je **eigen app** (zonder ChatGPT UI).  
- Backend: Node/Express proxy (beveiligt je API key) + SQLite opslag van gesprekken en berichten
- Frontend: simpele chat UI (HTML/JS) met conversatie-lijst
- Deploy: werkt lokaal én op Render (Web Service voor de server, Static Site optioneel voor extra frontends)

## 1) Snel starten (lokaal)
```bash
# 1) Dependencies
npm install

# 2) Zet je OpenAI API key
cp .env.example .env
# open .env en vul OPENAI_API_KEY in

# 3) Run
npm start
# Server draait op http://localhost:3000
```

Open daarna `public/index.html` in je browser (of serve via een simpele static server).  
Voor productie host je `public/` liefst via een **Static Site** en de server via een **Web Service**.

## 2) ENV variabelen
Maak een `.env` bestand (zie `.env.example`):
```
OPENAI_API_KEY=sk-....
OPENAI_MODEL=gpt-4o-mini
PORT=3000
DATABASE_URL=./data.db
CORS_ORIGIN=*
```

- **OPENAI_API_KEY**: jouw server-side sleutel (nooit in de frontend zetten).
- **OPENAI_MODEL**: standaard `gpt-4o-mini` (pas aan naar behoefte).
- **PORT**: poort voor Express.
- **DATABASE_URL**: SQLite bestandspad.
- **CORS_ORIGIN**: toegestane origin(s) voor frontend (voor productie: zet hier je domein).

## 3) API endpoints
- `POST /api/convos` → `{ title? }` → maakt nieuwe conversatie → `{ id }`
- `GET  /api/convos` → lijst van conversaties (laatste 50)
- `GET  /api/messages?conversationId=ID` → alle berichten voor die conversatie
- `POST /api/chat` → `{ conversationId, message }` → bewaart user-bericht, vraagt OpenAI, bewaart en geeft antwoord terug

> Alle antwoorden worden in SQLite opgeslagen in de tabellen `conversations` en `messages`.

## 4) Render deploy
### A) Web Service (server)
1. **New → Web Service** en koppel deze repo
2. Build command: `npm install`
3. Start command: `npm start`
4. Add Environment variables:
   - `OPENAI_API_KEY` = jouw sleutel
   - `OPENAI_MODEL` = `gpt-4o-mini` (of naar keuze)
   - `DATABASE_URL` = `/opt/render/project/src/data.db`
   - `CORS_ORIGIN` = `*` (of je static site URL)
5. Deploy

### B) Static Site (frontend – optioneel)
- Als je de chat-UI als **aparte** static site wil hosten:
  1. New → Static Site
  2. Publish Directory: `public`
  3. In `public/app.js` zet je `API_BASE` naar jouw Web Service URL

> Je kan ook de server zelf static files laten serveren: ga naar `http://<server-URL>/` om de chat te gebruiken.

## 5) Veiligheid
- API key blijft 100% op de server (Express); frontend praat alleen met **/api**.
- Voor productie: vervang `CORS_ORIGIN=*` door je echte domein.
- Voeg optioneel rate limiting toe, auth, en encryptie op de DB.

Veel succes! 🚀
