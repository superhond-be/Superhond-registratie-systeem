import express from "express";
import cors from "cors";
import agendaRoutes from "./routes/agenda.js";
import sheetsRoutes from "./routes/sheets.js"; // ← onze proxy naar Apps Script

const app = express();
const PORT = process.env.PORT || 3000;
const ORIGIN = process.env.CORS_ORIGIN || "*";

app.use(cors({ origin: ORIGIN }));
app.use(express.json());

// (optioneel) serveer je /public-map als statische site
app.use(express.static("public"));

// Healthcheck & demo
app.get("/health", (_req, res) => res.status(200).send("OK"));
app.get("/api/ping", (_req, res) => res.json({ ok: true, t: Date.now() }));

// API-routes
app.use(sheetsRoutes);              // → /api/sheets
app.use("/api/agenda", agendaRoutes);

// 404 & error handler
app.use((req, res) => res.status(404).json({ ok: false, error: "Not found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Server error", detail: String(err) });
});

app.listen(PORT, () => {
  console.log(`Superhond API draait op :${PORT}`);
});
