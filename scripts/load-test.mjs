// Load test: 100 → 500 → 1000 concurrent chat-completion requests.
// Measures req/s, p50/p95 latency, error rate. Synthetic only — do not
// claim production scalability from these numbers.
// Usage: node scripts/load-test.mjs --base http://localhost:8080 --key sk_live_... [--levels 100,500,1000]
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith("--") ? [a.slice(2), arr[i + 1]] : []).filter(([k, v]) => k && v && !v.startsWith("--")));
const base = args.base || "http://localhost:8080";
const key = args.key || process.env.GATEWAY_KEY || "";
const levels = (args.levels || "100,500,1000").split(",").map(Number);
if (!key) { console.error("missing --key (gateway API key)"); process.exit(1); }

async function one(i) {
  const t0 = Date.now();
  try {
    const r = await fetch(base + "/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "mock-medium", messages: [{ role: "user", content: "load test prompt " + i }] }),
    });
    await r.text();
    return { ok: r.status === 200, ms: Date.now() - t0 };
  } catch { return { ok: false, ms: Date.now() - t0 }; }
}

for (const n of levels) {
  const t0 = Date.now();
  const results = await Promise.all(Array.from({ length: n }, (_, i) => one(i)));
  const dt = (Date.now() - t0) / 1000;
  const lats = results.map(r => r.ms).sort((a, b) => a - b);
  const errs = results.filter(r => !r.ok).length;
  console.log(`concurrency=${n} rps=${(n / dt).toFixed(1)} p50=${lats[Math.floor(n / 2)]}ms p95=${lats[Math.floor(n * 0.95)]}ms errors=${errs}`);
}
