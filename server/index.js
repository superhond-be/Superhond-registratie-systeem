// server/index.js
import express from "express";
import cors from "cors";
import sheetsRoutes from "./routes/sheets.js";
// import agendaRoutes from "./routes/agenda.js"; // optioneel

const app = express();
const PORT = process.env.PORT || 3000;
const ORIGIN = process.env.CORS_ORIGIN || "*";

app.use(cors({ origin: ORIGIN }));
app.use(express.json());

// eventueel je front-end tonen
app.use(express.static("public"));

// ---- Test- en health-routes ----
app.get("/health", (_req, res) => res.status(200).send("OK"));
app.get("/api/ping", (_req, res) => res.json({ ok: true, t: Date.now() }));

// ---- API-routes ----
app.use(sheetsRoutes);
// app.use("/api/agenda", agendaRoutes);

// ---- Fallback ----
app.use((req, res) => res.status(404).json({ ok: false, error: "Not found" }));

app.listen(PORT, () => console.log(`🐶 Superhond API actief op :${PORT}`));
