// .env: GAS_BASE_URL = https://script.google.com/macros/s/AKfycbw.../exec
import express from "express";
import fetch from "node-fetch";

const router = express.Router();
const GAS_BASE_URL = process.env.GAS_BASE_URL; // gebruik de STABIELE /exec-link!

if (!GAS_BASE_URL) {
  console.warn("[sheets] GAS_BASE_URL ontbreekt. /api/sheets zal 500 teruggeven.");
}

// CORS preflight (handig voor externe clients, al dekt cors() dit meestal al)
router.options("/api/sheets", (_req, res) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.status(204).end();
});

// Proxy GET -> Apps Script
router.get("/api/sheets", async (req, res) => {
  try {
    if (!GAS_BASE_URL) {
      res.set("Access-Control-Allow-Origin", "*");
      return res.status(500).json({ ok: false, error: "GAS_BASE_URL ontbreekt op de server" });
    }

    // Bouw doel-URL (server volgt automatisch redirect naar googleusercontent.com)
    const qs = new URLSearchParams(req.query).toString();
    const target = `${GAS_BASE_URL}${qs ? `?${qs}` : ""}`;

    const r = await fetch(target, { redirect: "follow" });
    const text = await r.text(); // Apps Script antwoord is JSON-tekst

    res.set({
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    });
    return res.status(r.status).send(text);
  } catch (err) {
    res.set("Access-Control-Allow-Origin", "*");
    return res.status(502).json({ ok: false, error: "Proxy-fout", detail: String(err) });
  }
});

export default router;
