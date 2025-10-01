import express from "express";
import cors from "cors";
import agendaRoutes from "./routes/agenda.js";

const app = express();
const PORT = process.env.PORT || 3000;
const ORIGIN = process.env.CORS_ORIGIN || "*";

app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json());

// Healthcheck
app.get("/health", (_req, res) => res.status(200).send("OK"));

// Demo API
app.get("/api/ping", (_req, res) => res.json({ ok: true, t: Date.now() }));

// Agenda API
app.use("/api/agenda", agendaRoutes);

app.listen(PORT, () => console.log(`Superhond API draait op :${PORT}`));
