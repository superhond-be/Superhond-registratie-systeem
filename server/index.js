import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// ====== Config ======
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const usePostgres = !!process.env.DATABASE_URL; // op Render krijg je deze automatisch
const repo = usePostgres
  ? (await import("./storage/postgres.js")).default
  : (await import("./storage/memory.js")).default;

// ====== Routes ======
app.get("/api", (req, res) => {
  res.json({ ok: true, db: usePostgres ? "postgres" : "memory" });
});

app.get("/health", (req, res) => res.send("ok"));

// ---- Klanten ----
app.get("/api/klanten", async (_req, res) => res.json(await repo.listKlanten()));
app.get("/api/klanten/:id", async (req, res) => {
  const row = await repo.getKlant(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Klant niet gevonden" });
  res.json(row);
});
app.post("/api/klanten", async (req, res) => {
  const { naam, email, telefoon } = req.body || {};
  if (!naam) return res.status(400).json({ error: "Veld 'naam' is verplicht" });
  const nieuw = await repo.createKlant({ naam, email, telefoon });
  res.status(201).json(nieuw);
});
app.put("/api/klanten/:id", async (req, res) => {
  const item = await repo.updateKlant(Number(req.params.id), req.body || {});
  if (!item) return res.status(404).json({ error: "Klant niet gevonden" });
  res.json(item);
});
app.delete("/api/klanten/:id", async (req, res) => {
  const ok = await repo.deleteKlant(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: "Klant niet gevonden" });
  res.status(204).end();
});

// ---- Honden (incl. dierenarts/registratie) ----
app.get("/api/honden", async (_req, res) => res.json(await repo.listHonden()));
app.post("/api/honden", async (req, res) => {
  const { klant_id, naam } = req.body || {};
  if (!klant_id || !naam)
    return res.status(400).json({ error: "Veld 'klant_id' en 'naam' zijn verplicht" });

  try {
    const nieuw = await repo.createHond(req.body);
    res.status(201).json(nieuw);
  } catch (e) {
    res.status(409).json({ error: e.message });
  }
});

// ====== Start ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Superhond API running on port ${PORT} (db=${usePostgres ? "postgres" : "memory"})`));
