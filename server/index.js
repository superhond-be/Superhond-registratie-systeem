import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const VERSION = pkg.version || "0.0.0";
const BUILD_TIME = process.env.BUILD_TIME || new Date().toISOString();

app.get("/api/version", (_req, res) => {
  res.json({ app: "superhond", version: VERSION, buildTime: BUILD_TIME });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API v${VERSION} @ ${BUILD_TIME} on ${PORT}`));
