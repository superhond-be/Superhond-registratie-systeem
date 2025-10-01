import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;
const ORIGIN = process.env.CORS_ORIGIN || "*";

app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => res.status(200).send("OK"));

// Demo
app.get("/api/ping", (_req, res) => res.json({ ok: true, t: Date.now() }));

app.listen(PORT, () => console.log(`API op :${PORT}`));
