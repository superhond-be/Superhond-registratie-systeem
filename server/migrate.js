import fs from "fs";
import path from "path";
import pg from "pg";

const { Client } = pg;
const root = path.resolve(process.cwd(), "..");
const schemaPath = path.join(root, "schema.sql");
const seedPath = path.join(root, "seed.sql");

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ontbreekt");

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const exec = async (filePath, label) => {
    if (!fs.existsSync(filePath)) {
      console.log(`[migrate] ${label} ontbreekt → overslaan (${filePath})`);
      return;
    }
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`[migrate] ${label} starten…`);
    await client.query(sql);
    console.log(`[migrate] ${label} klaar`);
  };

  try {
    await exec(schemaPath, "schema");
    if (process.env.RUN_SEED === "true") await exec(seedPath, "seed");
  } finally {
    await client.end();
  }
}

run().catch(e => {
  console.error("[migrate] FOUT:", e?.message || e);
  process.exit(1);
});
