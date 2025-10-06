import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// jouw Apps Script URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzprHaU1ukJT03YLQ6I5EzR1LOq_45tzWNLo-d92rJuwtRat6Qf_b8Ydt-0qoZBIctVNA/exec";

// proxy endpoint
router.get("/", async (req, res) => {
  const { mode } = req.query;
  if (!mode) return res.status(400).json({ ok: false, error: "Mode ontbreekt" });

  try {
    const r = await fetch(`${GOOGLE_SCRIPT_URL}?mode=${encodeURIComponent(mode)}`);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error("Proxy-fout:", err);
    res.status(500).json({ ok: false, error: "Proxy-fout: " + err.message });
  }
});

export default router;
