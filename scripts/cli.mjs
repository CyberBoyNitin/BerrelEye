#!/usr/bin/env node
// BerrelEye CLI: login, keys, logs, test. No limitations — real gateway calls.
// Usage:
//   node scripts/cli.mjs login --base http://localhost:8080 --email a@x.dev --password secret --org "Acme"
//   node scripts/cli.mjs keys --base ... --email ... --password ... [--name prod]
//   node scripts/cli.mjs logs --base ... --email ... --password ... [--limit 20]
//   node scripts/cli.mjs test --base ... --key sk_live_xxx [--prompt "Hello"]
const args = process.argv.slice(2);
const cmd = args[0];
const opt = {};
for (let i = 1; i < args.length; i += 2) {
  const k = args[i];
  const v = args[i + 1];
  if (!k?.startsWith("--")) continue;
  opt[k.slice(2)] = v;
}
const base = (opt.base || process.env.BERRELEYE_BASE || "http://localhost:8080").replace(/\/$/, "");
let cookies = "";
async function call(path, { method = "GET", body } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookies ? { Cookie: cookies } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = r.headers.get("set-cookie");
  if (setCookie) cookies = setCookie.split(";")[0];
  const text = await r.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { status: r.status, json };
}
async function login() {
  const { status, json } = await call("/api/auth/login", { method: "POST", body: { email: opt.email, password: opt.password } });
  if (status !== 200) { console.error("login failed", status, json); process.exit(1); }
  console.log("logged in as", json.user?.email, "orgs:", (json.organizations || []).length);
}
if (cmd === "login") {
  if (!opt.email || !opt.password) { console.error("need --email --password"); process.exit(1); }
  await login();
} else if (cmd === "keys") {
  await login();
  if (args.includes("--create") || opt.name) {
    const { status, json } = await call("/api/keys", { method: "POST", body: { name: opt.name || "cli", environment: opt.env || "live" } });
    console.log(status, json);
    if (json.key) console.log("FULL KEY (once):", json.key);
  } else {
    const { status, json } = await call("/api/keys");
    console.log(status, JSON.stringify(json, null, 2));
  }
} else if (cmd === "logs") {
  await login();
  const limit = opt.limit || "20";
  const { status, json } = await call(`/api/requests?limit=${limit}&offset=0`);
  console.log(status, JSON.stringify(json, null, 2));
} else if (cmd === "test") {
  const key = opt.key || process.env.BERRELEYE_KEY;
  if (!key) { console.error("need --key"); process.exit(1); }
  const r = await fetch(base + "/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "mock-medium", messages: [{ role: "user", content: opt.prompt || "Hello via CLI" }] }),
  });
  console.log("status", r.status);
  console.log(await r.text());
} else {
  console.log("commands: login | keys [--name] | logs [--limit] | test --key");
}
