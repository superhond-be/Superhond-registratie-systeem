// netlify/functions/get-agenda.js
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Lazy import: alleen proberen als env aanwezig is.
async function fetchFromSupabase() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;

  // Voorbeeld: haal publieke agenda-rows op uit een view of query.
  // Hier gekozen: SELECT uit lessen + reeksen met is_public=true en komende datums.
  const url = `${SUPABASE_URL}/rest/v1/rpc/get_public_agenda`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "count=none"
    },
    body: JSON.stringify({
      // optionele parameters voor de RPC (bijv. vanaf vandaag)
      from_date: new Date().toISOString().slice(0, 10)
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Supabase RPC error: ${res.status} ${res.statusText} – ${txt}`);
  }
  return await res.json();
}

function readBundledAgenda() {
  // Door included_files staat data/agenda.json in het Lambda bundlepad.
  const root = process.env.LAMBDA_TASK_ROOT || process.cwd();
  const p = path.join(root, "data", "agenda.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function fetchFromSite(event) {
  // Laatste redmiddel: fetch de statische file van je eigen host.
  const host =
    process.env.PUBLIC_BASE_URL ||
    (event && (event.headers["x-forwarded-host"] || event.headers.host));
  if (!host) return null;

  const url = `https://${host}/data/agenda.json?cb=${Date.now().toString(36)}`;
  const res = await fetch(url, { headers: { "User-Agent": "NetlifyFunc" } });
  if (!res.ok) return null;
  return await res.json();
}

function corsHeaders() {
  const origin =
    process.env.CORS_ALLOW_ORIGIN && process.env.CORS_ALLOW_ORIGIN !== "*"
      ? process.env.CORS_ALLOW_ORIGIN
      : "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders() };
  }

  try {
    let payload = null;

    // 1) Supabase (indien geconfigureerd)
    try { payload = await fetchFromSupabase(); } catch (e) { console.warn(e.message); }

    // 2) Bundled JSON
    if (!payload) {
      payload = readBundledAgenda();
    }

    // 3) Fetch van de site
    if (!payload) {
      payload = await fetchFromSite(event);
    }

    if (!payload) throw new Error("Geen agenda-data beschikbaar via enige bron.");

    const body = JSON.stringify(payload);
    const etag = crypto.createHash("sha1").update(body).digest("hex");

    const ttl = parseInt(process.env.CACHE_TTL_SECONDS || "60", 10);
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${ttl}, s-maxage=${ttl * 5}`,
      ETag: etag,
      ...corsHeaders()
    };

    if (event.headers["if-none-match"] === etag) {
      return { statusCode: 304, headers };
    }

    return {
      statusCode: 200,
      headers,
      body
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
      body: JSON.stringify({ error: "Agenda kon niet geladen worden." })
    };
  }
};
