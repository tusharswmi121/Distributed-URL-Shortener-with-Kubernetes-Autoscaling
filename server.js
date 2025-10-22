// server.js — SHA-256 based short codes (deterministic)
import express from 'express';
import Redis from 'ioredis';
import crypto from 'crypto';

const app = express();

const BASE_DOMAIN = 'short.ly';                         // shown in responses
const REDIS_HOST = process.env.REDIS_HOST || 'redis-service';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const TTL_SECONDS = 86400;                              // 24h

app.use(express.json());

// Simple CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Robust Redis client
const redis = new Redis(REDIS_PORT, REDIS_HOST, {
  connectTimeout: 2000,
  retryStrategy: (times) => Math.min(200 * times, 2000),
});

// Helpers
function isValidUrl(u) {
  try {
    const x = new URL(u);
    return ['http:', 'https:'].includes(x.protocol) && !!x.host;
  } catch {
    return false;
  }
}

// Deterministic 6-char code from SHA-256 hex digest.
// Collision handling: slide a 6-char window along the hash until we find a free slot
// or a slot already holding the same URL.
async function codeFromSha(url, maxWindows = 16) {
  const hashHex = crypto.createHash('sha256').update(url).digest('hex'); // 64 hex chars
  for (let i = 0; i <= hashHex.length - 6 && i < maxWindows; i++) {
    const code = hashHex.substring(i, i + 6); // e.g., "a1b2c3"
    const existing = await redis.get(code);
    if (!existing) {
      // Reserve with TTL
      const ok = await redis.set(code, url, 'NX', 'EX', TTL_SECONDS);
      if (ok === 'OK') return code;
      // Rare race: someone just claimed it; retry next window
    } else if (existing === url) {
      // Same mapping already present — refresh TTL and return
      await redis.expire(code, TTL_SECONDS);
      return code;
    }
    // else: collision with a different URL, try next window
  }
  // Fallback: append a tiny salt and try again (still deterministic per URL+salt)
  for (let salt = 1; salt <= 100; salt++) {
    const h = crypto.createHash('sha256').update(url + '#' + salt).digest('hex');
    const code = h.substring(0, 6);
    const existing = await redis.get(code);
    if (!existing) {
      const ok = await redis.set(code, url, 'NX', 'EX', TTL_SECONDS);
      if (ok === 'OK') return code;
    } else if (existing === url) {
      await redis.expire(code, TTL_SECONDS);
      return code;
    }
  }
  throw new Error('Could not allocate unique code (hash collisions).');
}

// Routes
app.post('/shorten', async (req, res) => {
  const { url } = req.body || {};
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }
  try {
    const code = await codeFromSha(url);
    return res.status(201).json({
      short_url: `http://${BASE_DOMAIN}/${code}`,
      original_url: url,
      code,
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Could not allocate short code, please retry' });
  }
});

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

// Health
app.get('/healthz', async (_req, res) => {
  try { await redis.ping(); return res.send('OK'); }
  catch { return res.status(503).send('Redis unavailable'); }
});

app.get('/', async (_req, res) => {
  try { await redis.ping(); return res.json({ status: 'healthy', redis: 'connected', version: '1.0', domain: BASE_DOMAIN }); }
  catch (e) { return res.status(500).json({ status: 'unhealthy', error: String(e) }); }
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Express server listening on http://0.0.0.0:${PORT}`);
});
