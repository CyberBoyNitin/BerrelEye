# BerrelEye — AI Cost Optimization Gateway

> "Cloudflare for LLM cost optimization" (internal mental model, not branding.)

Companies point their existing OpenAI-compatible traffic at BerrelEye.
We observe usage, calculate real costs, find cheaper routes, enforce
security/caching/budgets, and prove savings in the dashboard.

## Quickstart (Docker)

### From source

```bash
git clone https://github.com/CyberBoyNitin/BerrelEye.git
cd BerrelEye
cp .env.example .env
# set ENCRYPTION_KEY (openssl rand -base64 32) and provider keys in .env
docker compose up --build
```

### Prebuilt images (tagged releases)

```bash
git clone https://github.com/CyberBoyNitin/BerrelEye.git
cd BerrelEye
cp .env.example .env
docker compose -f docker-compose.release.yml up -d
# pin a version: BERRELEYE_VERSION=1.0.0 docker compose -f docker-compose.release.yml up -d
```

- Gateway: http://localhost:8080 (`/health`, `/ready`, `/v1/*`)
- Dashboard: http://localhost:3000
- ML service: http://localhost:8001

Onboarding: sign up at `/signup` → add provider in Settings →
create API key in API Keys → send:

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hello"}]}'
```

Shadow mode (default) analyzes traffic without rerouting. Switch a
routing policy to `AUTO` to let the gateway choose cheaper models —
every decision carries recorded reasons inspectable in Request detail.

## Local dev without Docker

Gateway runs with zero infra: omit `DATABASE_URL` and it uses an
in-process store; Redis unreachable → in-process rate limiting;
`ML_SERVICE_URL` empty → deterministic regex PII + hash embeddings.
Set real provider keys for real completions; otherwise the `mock`
provider returns clearly-marked synthetic responses so the full
lifecycle (auth → routing → cost → dashboard) is exercisable.

```bash
# gateway (requires Go 1.22+)
cd apps/gateway && STORE=memory SEED_DEMO=true go run ./cmd/server
# ml-service
cd apps/ml-service && pip install -r requirements.txt && uvicorn app:app --port 8001
# web
cd apps/web && npm install && npm run dev
```

## Repo layout

```
apps/gateway      Go gateway (HTTP, auth, routing, providers, streaming, cost)
apps/ml-service   FastAPI: PII detection, embeddings, classifier experiments
apps/web          Next.js dashboard + landing + docs
infra/migrations  Postgres + pgvector schema
packages/shared-types  shared TS types + OpenAPI sketch
docs/             architecture, api, deployment, security
scripts/          seed helpers, load test (k6-style node script)
```

## Implementation status vs prompt.md

- Phases 1–20 implemented in V1 scope; Kubernetes/Kafka/SSO/custom
  vector DB/complex billing intentionally deferred per §65.
- Anthropic streaming replays deltas (documented in providers/anthropic.go).
- Semantic cache: exact-cache primary; pgvector similarity gated behind
  org opt-in + threshold + compatible params (§23–24).
- `ENCRYPTION_KEY` unset → provider secrets stored with a dev-only key
  and flagged `dev_only: true`; set a real key for production.
- Mock provider usage is word-estimated and marked `Estimated=true`;
  dashboard labels estimates as estimates, never as money saved.

## Releases

Pushing a `v*` tag builds and publishes the gateway, ML service, and web
images to GHCR, then creates a GitHub Release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The three images are published publicly to GHCR as
`ghcr.io/cyberboynitin/berreleye-{gateway,ml-service,web}`.
Users then run `docker compose -f docker-compose.release.yml up -d`.

## Testing

```bash
cd apps/gateway && go test ./...
cd apps/ml-service && python -m pytest -q
cd apps/web && npx tsc --noEmit && npm run build
node scripts/load-test.mjs --base http://localhost:8080 --key $KEY
```

Critical coverage: tenant isolation, revoked keys, secret redaction,
streaming, retry/fallback, 429 retry, semantic-cache tenancy, PII scope,
cost math, shadow-no-reroute, auto-routing, budgets, DB-backed dashboard,
failed-provider recording, OFF-respects-choice.

## Env vars

See `.env.example`: `DATABASE_URL REDIS_URL ENCRYPTION_KEY
SESSION_SECRET OPENAI_API_KEY ANTHROPIC_API_KEY ML_SERVICE_URL
NEXT_PUBLIC_API_URL`. Never commit real credentials; never put provider
keys in `NEXT_PUBLIC_*`.
