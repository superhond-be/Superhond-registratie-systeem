#!/usr/bin/env node
/**
 * Superhond bump script
 * - Update /public/version.json
 * - Verhoog patch (default), of minor/major via argument
 * - Schrijf buildTime
 * - Maak Git-tag aan en push
 */

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const versionFile = resolve(__dirname, "../public/version.json");

// 1) huidige versie
let current = { version: "0.0.0", buildTime: "" };
try {
  current = JSON.parse(readFileSync(versionFile, "utf-8"));
} catch {
  console.log("⚠️ Geen geldige version.json gevonden, start vanaf 0.0.0");
}

// 2) argument bepalen
const arg = process.argv[2]; // kan 'major' | 'minor' | 'patch'
const parts = current.version.split(".").map(n => parseInt(n, 10));
while (parts.length < 3) parts.push(0);

if (arg === "major") {
  parts[0]++; parts[1] = 0; parts[2] = 0;
} else if (arg === "minor") {
  parts[1]++; parts[2] = 0;
} else {
  parts[2]++;
}

const newVersion = parts.join(".");
const buildTime = new Date().toISOString();

// 3) schrijven
const updated = { version: newVersion, buildTime };
writeFileSync(versionFile, JSON.stringify(updated, null, 2));
console.log(`✅ version.json bijgewerkt → ${newVersion} (${buildTime})`);

// 4) Git commit + tag + push
try {
  execSync("git add public/version.json");
  execSync(`git commit -m "bump: v${newVersion}"`);
  execSync(`git tag v${newVersion}`);
  execSync("git push");
  execSync("git push --tags");
  console.log(`✅ Git commit & tag v${newVersion} aangemaakt en gepusht`);
} catch (err) {
  console.warn("⚠️ Git-commando’s konden niet uitgevoerd worden:", err.message);
}
