// server.js — Superhond server + Sheets-proxy (ESM)
// - Static hosting van /public
// - Kleine JSON "agenda" opslag in /data/agenda.json
// - CORS-vrije proxy naar Google Apps Script: GET /api/sheets?mode=ping|klanten|honden
// --------------------------------------------------

import express from "express";
import fs from "fs/promises";
import path from "path";

// In Node 18+ is fetch global. Valt terug op node-fetch als het niet bestaat.
let _fetch = globalThis.fetch;
if (!_fetch) {
  const mod = await import("node-fetch");
  _fetch = mod.default;
}

const app = express();
const PORT = process.env.PORT || 3000;

// === Config ===
const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const AGENDA_FILE = path.join(DATA_DIR, "agenda.json");

// Zet hier je Web App /exec URL (kan ook via env SUPERHOND_API_BASE)
const SUPERHOND_API_BASE = process.env.SUPERHOND_API_BASE || ""; // bv. "https://script.google.com/macros/s/.../exec"

// === Helpers ===
async function ensureDataFile() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch {}
  try { await fs.access(AGENDA_FILE); }
  catch { await fs.writeFile(AGENDA_FILE, "[]", "utf8"); }
}

function isHTML(s = "") {
  return /^\s*</.test(String(s).trim());
}

async function fetchWithTimeout(url, ms = 12000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await _fetch(url, { signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

function sanitizeBaseOverride(candidate = "") {
  // Voor testen kun je ?base=... meegeven, MAAR alleen GAS domeinen toestaan.
  try {
    const u = new URL(candidate);
    const ok = u.hostname === "script.google.com" && u.pathname.startsWith("/macros/s/");
    return ok ? u.origin + u.pathname : "";
  } catch { return ""; }
}

// === Middleware ===
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(ROOT, "public"), { etag: false, cacheControl: true, maxAge: 0 }));

// Klein health-endpoint
app.get("/healthz", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// === API: agenda (demo opslag) ===
app.post("/api/agenda", async (req, res) => {
  try {
    await ensureDataFile();
    await fs.writeFile(AGENDA_FILE, JSON.stringify(req.body ?? [], null, 2), "utf8");
    res.set("Cache-Control", "no-store").json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

app.get("/api/agenda", async (_req, res) => {
  try {
    await ensureDataFile();
    const data = await fs.readFile(AGENDA_FILE, "utf8");
    res.type("application/json").set("Cache-Control", "no-store").send(data);
  } catch (err) {
    // Als het bestand er niet is of kapot is, geef lege lijst terug
    res.set("Cache-Control", "no-store").status(200).json([]);
  }
});

// === API: Sheets-proxy (CORS-vrij lezen van GAS) ===
// Gebruik: GET /api/sheets?mode=ping|klanten|honden
// Optioneel (alleen voor test): ?base=https://script.google.com/macros/s/.../exec
app.get("/api/sheets", async (req, res) => {
  try {
    const mode = String(req.query.mode || "ping").toLowerCase();
    if (!mode) return res.status(400).json({ ok: false, error: "Query ?mode ontbreekt" });

    // Kies basis-URL: env is leidend. Alleen als env leeg is, een veilige override toestaan.
    let base = (SUPERHOND_API_BASE || "").trim();
    if (!base) {
      // Optionele override voor test, streng beperkt tot script.google.com
      const override = sanitizeBaseOverride(String(req.query.base || ""));
      if (!override) return res.status(500).json({ ok: false, error: "SUPERHOND_API_BASE ontbreekt (of onveilige base override)" });
      base = override;
    }

    const url = `${base}?mode=${encodeURIComponent(mode)}&t=${Date.now()}`;
    const upstream = await fetchWithTimeout(url, 12000);
    const text = await upstream.text();

    // Upstream status doorgeven
    if (!upstream.ok) {
      return res
        .status(upstream.status)
        .json({ ok: false, error: `Upstream ${upstream.status}`, body: text.slice(0, 200) });
    }

    // Soms stuurt GAS HTML (login / fout). Dat is niet bruikbaar voor fetch().
    if (isHTML(text)) {
      return res.status(502).json({
        ok: false,
        error: "Upstream gaf HTML (login/fout). Is de Web App publiek (Anyone, even anonymous) en gebruik je de /exec URL?",
      });
    }

    // Geldige JSON?
    let json;
    try { json = JSON.parse(text); }
    catch {
      return res.status(502).json({ ok: false, error: "Upstream gaf ongeldige JSON" });
    }

    res.set("Cache-Control", "no-store").json(json);
  } catch (err) {
    const msg = err?.name === "AbortError" ? "Timeout naar upstream" : (err?.message || String(err));
    res.status(500).json({ ok: false, error: msg });
  }
});

// === Start server ===
app.listen(PORT, () => {
  console.log(`✅ Superhond server draait op http://localhost:${PORT}`);
  if (!SUPERHOND_API_BASE) {
    console.log("ℹ️  SUPERHOND_API_BASE is niet gezet. Je kunt tijdelijk testen met ?base=... in /api/sheets,");
    console.log("    maar zet deze env var in productie altijd in (Render → Environment → SUPERHOND_API_BASE).");
  }
});
