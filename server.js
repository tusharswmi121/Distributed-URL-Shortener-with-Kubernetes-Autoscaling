// server.js — MySQL (Permanent DB) + Redis (24h Cache)
import express from "express";
import Redis from "ioredis";
import mysql from "mysql2/promise";
import crypto from "crypto";

const app = express();

const BASE_DOMAIN = process.env.BASE_DOMAIN || "short.ly";
const REDIS_HOST = process.env.REDIS_HOST || "redis";
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const TTL_SECONDS = Number(process.env.TTL_SECONDS || 86400);

const MYSQL_HOST = process.env.MYSQL_HOST || "mysql";
const MYSQL_USER = process.env.MYSQL_USER || "urluser";
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || "urlpass";
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || "urlshort";

app.use(express.json());

// --- Simple CORS ---
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// --- Redis Client ---
const redis = new Redis(REDIS_PORT, REDIS_HOST, {
  connectTimeout: 2000,
  retryStrategy: (times) => Math.min(200 * times, 2000),
});

// --- MySQL Connection Pool ---
const db = await mysql.createPool({
  host: MYSQL_HOST,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE,
  connectionLimit: 10,
});

// --- Ensure table exists ---
await db.query(`
  CREATE TABLE IF NOT EXISTS urls (
    code VARCHAR(16) PRIMARY KEY,
    long_url TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    clicks BIGINT DEFAULT 0
  );
`);

// --- Helpers ---
function isValidUrl(u) {
  try {
    const x = new URL(u);
    return ["http:", "https:"].includes(x.protocol);
  } catch {
    return false;
  }
}

function* codeCandidates(url) {
  const hex = crypto.createHash("sha256").update(url).digest("hex");
  for (let i = 0; i < hex.length - 6 && i < 16; i++) yield hex.substring(i, i + 6);
  for (let salt = 1; salt <= 50; salt++) {
    const h = crypto.createHash("sha256").update(url + "#" + salt).digest("hex");
    yield h.substring(0, 6);
  }
}

// --- API: Shorten URL ---
app.post("/shorten", async (req, res) => {
  const { url } = req.body || {};
  if (!url || !isValidUrl(url))
    return res.status(400).json({ error: "Invalid URL format" });

  try {
    // 1️⃣ Check MySQL first
    const [rows] = await db.query("SELECT code FROM urls WHERE long_url = ?", [url]);
    if (rows.length) {
      const code = rows[0].code;
      await redis.set(code, url, "EX", TTL_SECONDS);
      return res.status(201).json({
        short_url: `http://${BASE_DOMAIN}/${code}`,
        original_url: url,
        code,
      });
    }

    // 2️⃣ Generate unique code
    let code = null;
    for (const candidate of codeCandidates(url)) {
      try {
        await db.query("INSERT INTO urls (code, long_url) VALUES (?, ?)", [
          candidate,
          url,
        ]);
        code = candidate;
        break;
      } catch {
        // code exists → try next
      }
    }

    if (!code)
      return res.status(503).json({ error: "Could not allocate short code" });

    // 3️⃣ Cache it
    await redis.set(code, url, "EX", TTL_SECONDS);

    return res.status(201).json({
      short_url: `http://${BASE_DOMAIN}/${code}`,
      original_url: url,
      code,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Database error" });
  }
});

// --- API: Redirect by code ---
app.get("/:code", async (req, res) => {
  const { code } = req.params;
  try {
    let url = await redis.get(code);
    if (!url) {
      const [rows] = await db.query("SELECT long_url FROM urls WHERE code = ?", [
        code,
      ]);
      if (!rows.length)
        return res.status(404).json({ error: "Short URL not found" });
      url = rows[0].long_url;
      await redis.set(code, url, "EX", TTL_SECONDS);
    }

    // Increment click count (async)
    db.query("UPDATE urls SET clicks = clicks + 1 WHERE code = ?", [code]);
    return res.redirect(302, url);
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: "Service unavailable" });
  }
});

// --- Health Checks ---
app.get("/healthz", async (_req, res) => {
  try {
    await Promise.all([redis.ping(), db.query("SELECT 1")]);
    return res.send("OK");
  } catch {
    return res.status(503).send("Unavailable");
  }
});

app.get("/", async (_req, res) => {
  try {
    await Promise.all([redis.ping(), db.query("SELECT 1")]);
    return res.json({
      status: "healthy",
      redis: "connected",
      mysql: "connected",
      version: "1.0",
      domain: BASE_DOMAIN,
    });
  } catch (e) {
    return res.status(500).json({ status: "unhealthy", error: String(e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`)
);
