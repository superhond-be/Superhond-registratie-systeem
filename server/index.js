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
// .env: GAS_BASE_URL = https://script.google.com/macros/s/AKfycbw.../exec
import express from "express";
import fetch from "node-fetch";

const router = express.Router();
const GAS_BASE_URL = process.env.GAS_BASE_URL; // gebruik de STABIELE /exec-link!

// CORS preflight
router.options("/api/sheets", (req, res) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.status(204).end();
});

// Proxy GET -> Apps Script
router.get("/api/sheets", async (req, res) => {
  try {
    if (!GAS_BASE_URL) {
      return res.status(500).json({ ok:false, error:"GAS_BASE_URL ontbreekt op de server" });
    }

    // Bouw de doel-URL (exec volgt server-side automatisch de redirect)
    const qs = new URLSearchParams(req.query).toString();
    const target = `${GAS_BASE_URL}${qs ? "?" + qs : ""}`;

    const r = await fetch(target, { redirect: "follow" });
    const text = await r.text();

    // Apps Script geeft JSON; lever het transparant door
    res.set({
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"

// .env: GAS_BASE_URL = https://script.google.com/macros/s/AKfycbw.../exec
import express from "express";
import fetch from "node-fetch";

const router = express.Router();
const GAS_BASE_URL = process.env.GAS_BASE_URL; // gebruik de STABIELE /exec-link!

// CORS preflight
router.options("/api/sheets", (req, res) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.status(204).end();
});

// Proxy GET -> Apps Script
router.get("/api/sheets", async (req, res) => {
  try {
    if (!GAS_BASE_URL) {
      return res.status(500).json({ ok:false, error:"GAS_BASE_URL ontbreekt op de server" });
    }

    // Bouw de doel-URL (exec volgt server-side automatisch de redirect)
    const qs = new URLSearchParams(req.query).toString();
    const target = `${GAS_BASE_URL}${qs ? "?" + qs : ""}`;

    const r = await fetch(target, { redirect: "follow" });
    const text = await r.text();

    // Apps Script geeft JSON; lever het transparant door
    res.set({
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    });
    res.status(r.status).send(text);

  } catch (err) {
    res.set("Access-Control-Allow-Origin", "*");
    res.status(502).json({ ok:false, error:"Proxy-fout", detail:String(err) });
  }
});

export default router;

      
    });
    res.status(r.status).send(text);

  } catch (err) {
    res.set("Access-Control-Allow-Origin", "*");
    res.status(502).json({ ok:false, error:"Proxy-fout", detail:String(err) });
  }
});

export default router;
