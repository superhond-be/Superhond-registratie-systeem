import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public")); // jouw HTML/JS/CSS

// In-memory data (voorlopig, straks DB)
let klanten = [
  { id: 1, naam: "Jan Peeters", email: "jan@example.com", telefoon: "+32 495 11 22 33", adres: "Dorpsstraat 1, Retie", land: "BE" },
  { id: 2, naam: "Anja Jansen", email: "anja@example.nl", telefoon: "+31 6 12 34 56 78", adres: "Lindelaan 12, Bladel", land: "NL" }
];

let honden = [
  { id: 1, naam: "Bobby", ras: "Labrador", geboortedatum: "2023-06-15", eigenaarId: 1, chip: "BE-123-456" },
  { id: 2, naam: "Mila", ras: "Border Collie", geboortedatum: "2024-01-20", eigenaarId: 2, chip: "NL-987-654" }
];

// Helpers
function nextId(list) {
  return list.reduce((max, x) => Math.max(max, Number(x.id)), 0) + 1;
}

// Routes
// Healthcheck
app.get("/health", (req, res) => res.json({ status: "ok", tijd: new Date() }));

// Version info
app.get("/api/version", (req, res) => {
  res.json({
    app: "Superhond",
    version: "0.18.9",
    builtAt: new Date().toISOString(),
    apiOnline: true
  });
});

// Klanten
app.get("/api/klanten", (req, res) => res.json(klanten));

app.get("/api/klanten/:id", (req, res) => {
  const klant = klanten.find(k => k.id === Number(req.params.id));
  if (!klant) return res.status(404).json({ error: "Niet gevonden" });
  res.json(klant);
});

app.post("/api/klanten", (req, res) => {
  const nieuw = { id: nextId(klanten), ...req.body };
  klanten.push(nieuw);
  res.status(201).json(nieuw);
});

app.put("/api/klanten/:id", (req, res) => {
  const i = klanten.findIndex(k => k.id === Number(req.params.id));
  if (i < 0) return res.status(404).json({ error: "Niet gevonden" });
  klanten[i] = { ...klanten[i], ...req.body };
  res.json(klanten[i]);
});

app.delete("/api/klanten/:id", (req, res) => {
  const i = klanten.findIndex(k => k.id === Number(req.params.id));
  if (i < 0) return res.status(404).json({ error: "Niet gevonden" });
  // check: heeft klant nog honden?
  if (honden.some(h => h.eigenaarId === Number(req.params.id))) {
    return res.status(400).json({ error: "Kan klant niet verwijderen: heeft nog honden" });
  }
  klanten.splice(i, 1);
  res.status(204).end();
});

// Honden
app.get("/api/honden", (req, res) => res.json(honden));

app.get("/api/honden/:id", (req, res) => {
  const hond = honden.find(h => h.id === Number(req.params.id));
  if (!hond) return res.status(404).json({ error: "Niet gevonden" });
  res.json(hond);
});

app.post("/api/honden", (req, res) => {
  const nieuw = { id: nextId(honden), ...req.body };
  honden.push(nieuw);
  res.status(201).json(nieuw);
});

app.put("/api/honden/:id", (req, res) => {
  const i = honden.findIndex(h => h.id === Number(req.params.id));
  if (i < 0) return res.status(404).json({ error: "Niet gevonden" });
  honden[i] = { ...honden[i], ...req.body };
  res.json(honden[i]);
});

app.delete("/api/honden/:id", (req, res) => {
  const i = honden.findIndex(h => h.id === Number(req.params.id));
  if (i < 0) return res.status(404).json({ error: "Niet gevonden" });
  honden.splice(i, 1);
  res.status(204).end();
});

// Start
app.listen(PORT, () => {
  console.log(`✅ Superhond API draait op http://localhost:${PORT}`);
});
