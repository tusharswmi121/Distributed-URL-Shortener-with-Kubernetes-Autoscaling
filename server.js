// server.js (Express version)
import express from 'express';
import Redis from 'ioredis';
import crypto from 'crypto';

const app = express();

const BASE_DOMAIN = 'short.ly';
const REDIS_HOST = process.env.REDIS_HOST || 'redis-service';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const TTL_SECONDS = 86400; // 24h

// Body parser for JSON
app.use(express.json());

// Simple request logger (optional)
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// CORS (match previous behavior)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Robust Redis client with short retry backoff
const redis = new Redis(REDIS_PORT, REDIS_HOST, {
  connectTimeout: 2000,
  retryStrategy: (times) => Math.min(200 * times, 2000) // 200ms .. 2s
});

// URL validation
function isValidUrl(u) {
  try {
    const x = new URL(u);
    return ['http:', 'https:'].includes(x.protocol) && !!x.host;
  } catch {
    return false;
  }
}

// Random base62 code
function genCode(n = 6) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  while (s.length < n) s += letters[crypto.randomInt(0, letters.length)];
  return s;
}

// Allocate a unique code atomically; retry a few times if collision occurs
async function saveWithRetry(url, maxTries = 5) {
  for (let i = 0; i < maxTries; i++) {
    const code = genCode(6);
    // SET key value NX EX TTL_SECONDS  => only if not exists + TTL 24h
    const ok = await redis.set(code, url, 'NX', 'EX', TTL_SECONDS);
    if (ok === 'OK') return code; // unique reservation succeeded
  }
  throw new Error('Could not allocate unique code after retries');
}

// Create short URL
app.post('/shorten', async (req, res) => {
  const { url } = req.body || {};
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }
  try {
    const code = await saveWithRetry(url, 5);
    return res.status(201).json({
      short_url: `http://${BASE_DOMAIN}/${code}`,
      original_url: url,
      code
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Could not allocate short code, please retry' });
  }
});

// Redirect by code
app.get('/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const url = await redis.get(code);
    if (!url) return res.status(404).json({ error: 'Short URL not found' });
    await redis.incr(`clicks:${code}`);
    return res.redirect(302, url);
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Service unavailable' });
  }
});

// Health endpoints
app.get('/', async (_req, res) => {
  try {
    await redis.ping();
    return res.json({
      status: 'healthy',
      redis: 'connected',
      version: '1.0',
      domain: BASE_DOMAIN
    });
  } catch (e) {
    return res.status(500).json({ status: 'unhealthy', error: String(e) });
  }
});

app.get('/healthz', async (_req, res) => {
  try {
    await redis.ping();
    return res.send('OK');
  } catch {
    return res.status(503).send('Redis unavailable');
  }
});

// Start server
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Express server listening on http://0.0.0.0:${PORT}`);
});
