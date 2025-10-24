// stress.js — no node-fetch required (Node 18+ has global fetch)
const [,, baseUrl = 'http://127.0.0.1:8081', totalStr = '500', concStr = '50'] = process.argv;
const TOTAL = Number(totalStr);
const CONC  = Number(concStr);

function randUrl() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 10; i++) slug += chars[Math.floor(Math.random() * chars.length)];
  return `https://example.com/${slug}`;
}

async function shortenOnce() {
  const res = await fetch(`${baseUrl}/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: randUrl() }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await res.json(); // we don't need the body, just ensure it parses
}

async function run() {
  console.log(`Target: ${baseUrl} | Requests: ${TOTAL} | Concurrency: ${CONC}`);
  const start = Date.now();

  let inFlight = 0, sent = 0, successes = 0, failures = 0;
  const launch = async () => {
    inFlight++;
    try {
      await shortenOnce();
      successes++;
    } catch (e) {
      failures++;
    } finally {
      inFlight--;
      if (sent < TOTAL) {
        sent++;
        launch();
      }
    }
  };

  // kick off up to CONC workers
  const kick = Math.min(CONC, TOTAL);
  sent = kick;
  const promises = Array.from({ length: kick }, () => launch());

  await Promise.all(promises);
  const dur = (Date.now() - start) / 1000;

  console.log('\nResults:');
  console.log(`  - Successes: ${successes}/${TOTAL}`);
  console.log(`  - Failures : ${failures}`);
  console.log(`  - Duration : ${dur.toFixed(2)} s`);
  console.log(`  - Rate     : ${(TOTAL / dur).toFixed(2)} req/s`);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
