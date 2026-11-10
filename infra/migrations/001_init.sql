-- BerrelEye initial schema. Every tenant-owned table carries organization_id.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'live',
  key_prefix TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  permissions TEXT NOT NULL DEFAULT 'gateway:chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

CREATE TABLE IF NOT EXISTS provider_configs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  base_url TEXT NOT NULL DEFAULT '',
  api_key_cipher BYTEA,
  api_key_hint TEXT NOT NULL DEFAULT '',
  dev_only BOOLEAN NOT NULL DEFAULT TRUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS models (
  model_name TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  input_price DOUBLE PRECISION NOT NULL,
  output_price DOUBLE PRECISION NOT NULL,
  context_window INT NOT NULL DEFAULT 8000,
  capabilities JSONB NOT NULL DEFAULT '[]',
  supports_streaming BOOLEAN NOT NULL DEFAULT TRUE,
  supports_tools BOOLEAN NOT NULL DEFAULT FALSE,
  supports_json BOOLEAN NOT NULL DEFAULT FALSE,
  quality_tier TEXT NOT NULL DEFAULT 'MEDIUM',
  latency_tier TEXT NOT NULL DEFAULT 'MEDIUM',
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS routing_policies (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  optimization_mode TEXT NOT NULL DEFAULT 'SHADOW',
  default_model TEXT NOT NULL DEFAULT 'mock-medium',
  quality_weight DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  cost_weight DOUBLE PRECISION NOT NULL DEFAULT 0.35,
  latency_weight DOUBLE PRECISION NOT NULL DEFAULT 0.15,
  semantic_cache_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  semantic_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.92,
  cache_ttl_seconds INT NOT NULL DEFAULT 3600,
  budget_behavior TEXT NOT NULL DEFAULT 'ALERT_ONLY'
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  api_key_id TEXT,
  request_id TEXT NOT NULL,
  requested_model TEXT NOT NULL,
  selected_model TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  estimated_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  latency_ms BIGINT NOT NULL DEFAULT 0,
  ttft_ms BIGINT NOT NULL DEFAULT 0,
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  cache_type TEXT,
  routing_mode TEXT NOT NULL DEFAULT 'SHADOW',
  routing_reason JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_requests_org_time ON requests(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS routing_decisions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  requested_model TEXT NOT NULL,
  recommended_model TEXT NOT NULL,
  selected_model TEXT NOT NULL,
  actual_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  estimated_optimized_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  estimated_savings DOUBLE PRECISION NOT NULL DEFAULT 0,
  routing_reason JSONB NOT NULL DEFAULT '[]',
  category TEXT NOT NULL DEFAULT 'UNKNOWN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_attempts (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  status_code INT NOT NULL DEFAULT 0,
  latency_ms BIGINT NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_id TEXT,
  type TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_org_time ON security_events(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS budgets (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  monthly_budget DOUBLE PRECISION,
  daily_budget DOUBLE PRECISION,
  per_request_limit DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  metadata TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cache_entries (
  organization_id TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  model_class TEXT NOT NULL DEFAULT 'chat',
  system_hash TEXT NOT NULL DEFAULT '',
  params_hash TEXT NOT NULL DEFAULT '',
  response TEXT NOT NULL,
  embedding vector(128),
  hit_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (organization_id, cache_key)
);
