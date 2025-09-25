import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// static files uit /public serveren
app.use(express.static(path.join(__dirname, "..", "public")));

// versie-info uit package.json + env
const pkgPath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const VERSION = pkg.version || "0.0.0";
const BUILD_TIME = process.env.BUILD_TIME || new Date().toISOString();
const COMMIT = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || "";

app.get("/api/version", (req, res) => {
  res.json({ app: "superhond", version: VERSION, buildTime: BUILD_TIME, commit: COMMIT });
});

// healthcheck
app.get("/health", (req, res) => res.send("ok"));

// start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Superhond op poort ${PORT} — v${VERSION} @ ${BUILD_TIME}`);
});
