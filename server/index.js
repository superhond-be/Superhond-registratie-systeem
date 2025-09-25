// server/index.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// --- VERSION META ---
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const VERSION = pkg.version || "0.0.0";
const BUILD_TIME = process.env.BUILD_TIME || new Date().toISOString();
const COMMIT = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || "";

// API → /api/version
app.get("/api/version", (_req, res) => {
  res.json({
    app: "superhond",
    version: VERSION,
    buildTime: BUILD_TIME,
    commit: COMMIT
  });
});

// (andere API-routes hier ...)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Superhond API op poort ${PORT} — v${VERSION} @ ${BUILD_TIME}`));
