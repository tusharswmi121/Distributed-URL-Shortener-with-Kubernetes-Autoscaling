import { setTimeout as delay } from 'node:timers/promises';
import crypto from 'node:crypto';
import fetch from 'node-fetch'; // npm i node-fetch

const API = process.argv[2] || 'http://127.0.0.1:8081';
const REQUESTS = parseInt(process.argv[3] || '200', 10);
const CONCURRENCY = parseInt(process.argv[4] || '20', 10);

function randUrl() {
  const r = crypto.randomBytes(6).toString('base64url'); // random path
  return `https://example.com/${r}`;
}

async function onePost() {
  const res = await fetch(`${API}/shorten`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: randUrl() }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return j.short_url;
}

async function run() {
  let inFlight = 0, sent = 0, ok = 0, fail = 0;
  const start = Date.now();

  async function worker() {
    while (sent < REQUESTS) {
      sent++;
      inFlight++;
      try {
        await onePost();
        ok++;
      } catch {
        fail++;
      } finally {
        inFlight--;
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.allSettled(workers);

  const secs = (Date.now() - start) / 1000;
  console.log(`\nResults:
  - Successes: ${ok}/${REQUESTS}
  - Failures : ${fail}
  - Duration : ${secs.toFixed(2)} s
  - Rate     : ${(REQUESTS / secs).toFixed(2)} req/s
  `);
}

run().catch(e => { console.error(e); process.exit(1); });
