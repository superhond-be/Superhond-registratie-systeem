#!/usr/bin/env node
/**
 * Superhond bump script
 * - Update /public/version.json
 * - Zet versie op patchniveau + huidige buildTime
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const versionFile = resolve(__dirname, "../public/version.json");

// Huidige versie inlezen
let current = { version: "0.0.0", buildTime: "" };
try {
  current = JSON.parse(readFileSync(versionFile, "utf-8"));
} catch (e) {
  console.log("Geen geldige version.json gevonden, start vanaf 0.0.0");
}

// patch +1
const parts = current.version.split(".").map(n => parseInt(n, 10));
while (parts.length < 3) parts.push(0);
parts[2]++;

const newVersion = parts.join(".");
const buildTime = new Date().toISOString();

const updated = { version: newVersion, buildTime };
writeFileSync(versionFile, JSON.stringify(updated, null, 2));

console.log(`✅ version.json bijgewerkt → ${newVersion} (${buildTime})`);
