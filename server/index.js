// server/index.js
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;
const ORIGIN = process.env.CORS_ORIGIN || "*";

app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json());

// Healthcheck voor Render
app.get("/health", (req, res) => res.status(200).send("OK"));

// Voorbeeld API (pas aan naar jouw routes)
app.get("/api/ping", (req, res) => res.json({ ok: true, t: Date.now() }));

// ...jouw overige routes hier

app.listen(PORT, () => {
  console.log(`Superhond API draait op :${PORT}`);
});
