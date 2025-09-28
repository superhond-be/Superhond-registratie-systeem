#!/usr/bin/env node
/**
 * Superhond split-seed
 * Doel: public/data/seed.json splitsen naar
 * - public/data/klanten.json
 * - public/data/honden.json
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = resolve(__dirname, "../public/data");

try {
  const seedFile = resolve(base, "seed.json");
  const raw = readFileSync(seedFile, "utf-8");
  const j = JSON.parse(raw);

  if (!Array.isArray(j.klanten) || !Array.isArray(j.honden)) {
    throw new Error("seed.json mist velden klanten[] en/of honden[]");
  }

  const klantenFile = resolve(base, "klanten.json");
  const hondenFile = resolve(base, "honden.json");

  writeFileSync(klantenFile, JSON.stringify(j.klanten, null, 2));
  writeFileSync(hondenFile, JSON.stringify(j.honden, null, 2));

  console.log(`✅ Split OK — ${j.klanten.length} klanten → klanten.json, ${j.honden.length} honden → honden.json`);
} catch (e) {
  console.error("❌ Split mislukt:", e.message);
  process.exit(1);
}
