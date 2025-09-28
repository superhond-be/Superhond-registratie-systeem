#!/usr/bin/env node
/**
 * Superhond bump script
 * - Update /public/version.json
 * - Verhoog patchnummer
 * - Schrijf buildTime
 * - Maak Git-tag aan en push naar origin
 */

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const versionFile = resolve(__dirname, "../public/version.json");

// 1) versie inlezen
let current = { version: "0.0.0", buildTime: "" };
try {
  current = JSON.parse(readFileSync(versionFile, "utf-8"));
} catch (e) {
  console.log("Geen geldige version.json gevonden, start vanaf 0.0.0");
}

// 2) patch +1
const parts = current.version.split(".").map(n => parseInt(n, 10));
while (parts.length < 3) parts.push(0);
parts[2]++;

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
