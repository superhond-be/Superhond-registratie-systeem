import express from "express";
import fs from "fs/promises";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware om JSON te lezen
app.use(express.json());

// Public map (frontend)
app.use(express.static("public"));

// === API routes ===

// POST: agenda opslaan
app.post("/api/agenda", async (req, res) => {
  try {
    const file = path.join(process.cwd(), "data", "agenda.json");
    await fs.writeFile(file, JSON.stringify(req.body, null, 2), "utf8");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET: agenda ophalen
app.get("/api/agenda", async (req, res) => {
  try {
    const file = path.join(process.cwd(), "data", "agenda.json");
    const data = await fs.readFile(file, "utf8");
    res.type("json").send(data);
  } catch (err) {
    res.status(404).json([]);
  }
});

// Server starten
app.listen(PORT, () => {
  console.log(`✅ Superhond server draait op http://localhost:${PORT}`);
});
