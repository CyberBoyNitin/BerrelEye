# Architecture

```
CLIENT → GATEWAY (:8080 /v1/*) → ROUTING/SECURITY/CACHE → PROVIDER → GATEWAY → CLIENT
                    ↓ telemetry (requests, costs, decisions, attempts, events)
               Postgres (durable) + Redis (limits/cache) + ML service (PII/embed/classify, optional)
                    ↓ session-cookie dashboard API (/api/*)
               Next.js (:3000, server-rendered, no secrets in browser)
```

Request lifecycle: authenticate (API key sha256) → validate →
policy → budget → PII detect/tokenize → exact-cache lookup →
routing analysis (always recorded) → provider exec with
backoff+jitter retry + capability-checked fallback → PII restore →
cost calc → persist → OpenAI-compatible response (SSE passthrough
for stream=true). Telemetry writes are inline in V1 (single Postgres
round-trips, no queue) — move to async workers when write volume
demands it.

# API

- `POST /v1/chat/completions` — OpenAI-compatible. `model: "auto"`
  uses the org default. `stream: true` → SSE. `X-AI-Cache: no-store`
  disables cache. Unknown params → 400 (never silently ignored).
- `GET /v1/models`, `GET /health`, `GET /ready`.
- Dashboard `/api/*`: auth (signup/login/logout/me), keys, providers
  (secrets never returned), models, routing (GET/PUT), requests,
  request detail (+decision/attempts/events), overview, analytics/*,
  security/events, budgets, audit, onboarding.

# Deployment

Single `docker compose up --build`. Set `ENCRYPTION_KEY`
(`openssl rand -base64 32`), `SESSION_SECRET`, provider keys.
Postgres data in `pgdata`, Redis in `redisdata`. Gateway runs
migrations on boot in postgres mode. Health: `/health` (liveness),
`/ready` (readiness). Scale gateway horizontally; Redis coordinates
limits; Postgres remains source of truth.

# Security

Tenant isolation at API + DB + cache + analytics layers; org_id always
derived from the API key/session, never trusted from the client.
API keys stored as sha256, shown once. Provider secrets AES-256-GCM
at rest; `dev_only` flagged without a real `ENCRYPTION_KEY`.
PII detection is best-effort regex; raw values never hit logs
(scrubbed) or analytics (types+counts only). Error format is uniform
and never leaks stack traces or secrets. See prompt.md §55/§57 for the
threat tests implemented in `apps/gateway/internal/...`.
