"""E2E verification per prompt.md section 63 (definition of done, items 2-24)."""
import json, urllib.request, urllib.error, http.cookiejar, sys

BASE = "http://localhost:8080"

class Ctx:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def req(self, method, path, body=None, headers=None):
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(BASE + path, data=data, method=method,
                                  headers={"Content-Type": "application/json", **(headers or {})})
        try:
            with self.opener.open(r) as resp:
                return resp.status, json.loads(resp.read() or b"{}")
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read() or b"{}")
            except Exception:
                return e.code, {}

    def gw(self, key, body, stream=False, extra_headers=None):
        data = json.dumps(body).encode()
        h = {"Content-Type": "application/json", "Authorization": "Bearer " + key, **(extra_headers or {})}
        r = urllib.request.Request(BASE + "/v1/chat/completions", data=data, method="POST", headers=h)
        try:
            with self.opener.open(r) as resp:
                raw = resp.read().decode()
                return resp.status, raw
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode()

c = Ctx()
fails = []
def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + (f" ({detail})" if detail and not cond else ""))
    if not cond:
        fails.append(name)

# health
s, b = c.req("GET", "/health")
check("health", s == 200, f"{s} {b}")

# signup org A
s, b = c.req("POST", "/api/auth/signup", {"email": "a@e2e.dev", "password": "password123", "org_name": "E2E A"})
check("signup A", s == 201, f"{s} {b}")
org_a = (b.get("organization") or {}).get("id")

# create key A
s, b = c.req("POST", "/api/keys", {"name": "e2e", "environment": "live"})
check("create key", s == 201 and b.get("key", "").startswith("sk_live_"), f"{s} {list(b)}")
key_a = b.get("key", "")

# real request (non-stream, mock provider)
s, raw = c.gw(key_a, {"model": "mock-medium", "messages": [{"role": "user", "content": "Hello gateway"}]})
check("chat completion 200", s == 200, f"{s} {raw[:200]}")
body = json.loads(raw)
check("usage tracked", body.get("usage", {}).get("total_tokens", 0) > 0, raw[:200])

# streaming
s, raw = c.gw(key_a, {"model": "mock-medium", "messages": [{"role": "user", "content": "Stream me"}], "stream": True})
check("streaming SSE", s == 200 and "data:" in raw and "[DONE]" in raw, f"{s} {raw[:200]}")

# dashboard reflects DB
s, b = c.req("GET", "/api/dashboard/overview")
check("overview real data", s == 200 and b.get("requests", 0) >= 2 and b.get("tokens", 0) > 0, f"{s} {b}")
check("spend>0", b.get("total_spend", 0) > 0, f"{b}")

# cache: repeat identical request -> cache_hit
s, raw1 = c.gw(key_a, {"model": "mock-medium", "messages": [{"role": "user", "content": "cache-me-123"}]})
s, raw2 = c.gw(key_a, {"model": "mock-medium", "messages": [{"role": "user", "content": "cache-me-123"}]})
s, b = c.req("GET", "/api/requests?limit=5")
recs = b.get("data", [])
hits = [r for r in recs if r.get("cache_hit")]
check("exact cache hit recorded", len(hits) >= 1, f"hits={len(hits)}")

# PII detection -> security event
s, raw = c.gw(key_a, {"model": "mock-medium", "messages": [{"role": "user", "content": "mail me at jane@example.com please"}]})
s, b = c.req("GET", "/api/security/events")
types = [e.get("type") for e in b.get("data", [])]
check("PII event stored", "PII_DETECTED" in types, f"{types}")

# shadow mode default: requested model kept
shadow = [r for r in recs if r.get("routing_mode") == "SHADOW"]
check("shadow mode active", len(shadow) >= 1, "")

# tenant isolation: org B cannot see org A requests
c2 = Ctx()
s, b = c2.req("POST", "/api/auth/signup", {"email": "b@e2e.dev", "password": "password123", "org_name": "E2E B"})
org_b = (b.get("organization") or {}).get("id")
s, b = c2.req("GET", "/api/requests?limit=50")
check("tenant B sees no A requests", s == 200 and b.get("total") == 0, f"{b}")
if recs:
    rid = recs[0].get("id")
    s, b = c2.req("GET", f"/api/requests/{rid}")
    check("cross-tenant detail denied", s == 404, f"{s}")

# revoke key -> denied
s, b = c.req("GET", "/api/keys")
kid = (b.get("data") or [{}])[0].get("id")
s, b = c.req("DELETE", f"/api/keys/{kid}")
check("revoke key", s == 200, f"{s}")
s, raw = c.gw(key_a, {"model": "mock-medium", "messages": [{"role": "user", "content": "after revoke"}]})
check("revoked key denied", s == 401, f"{s} {raw[:120]}")

# unsupported param rejected, not silently ignored
s, b = c.req("POST", "/api/keys", {"name": "k2"})
key2 = b.get("key", "")
s, raw = c.gw(key2, {"model": "mock-medium", "messages": [{"role": "user", "content": "x"}], "extra": {"foo": 1}})
check("unknown param 400", s == 400, f"{s} {raw[:120]}")

print()
print("E2E " + ("ALL PASS" if not fails else f"{len(fails)} FAILURES: {fails}"))
sys.exit(1 if fails else 0)
