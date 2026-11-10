-- 002: alerts + normalized telemetry + configurable rate limits.
ALTER TABLE routing_policies ADD COLUMN IF NOT EXISTS rate_limit_org_per_min INT NOT NULL DEFAULT 600;
ALTER TABLE routing_policies ADD COLUMN IF NOT EXISTS rate_limit_key_per_min INT NOT NULL DEFAULT 300;
ALTER TABLE routing_policies ADD COLUMN IF NOT EXISTS rate_limit_ip_per_min INT NOT NULL DEFAULT 300;

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  threshold DOUBLE PRECISION NOT NULL DEFAULT 0,
  channel TEXT NOT NULL DEFAULT 'dashboard',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_org ON alerts(organization_id);

CREATE TABLE IF NOT EXISTS request_messages (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reqmsg_req ON request_messages(request_id);

CREATE TABLE IF NOT EXISTS request_usage (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  estimated BOOLEAN NOT NULL DEFAULT FALSE,
  latency_ms BIGINT NOT NULL DEFAULT 0,
  ttft_ms BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS request_costs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  input_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  output_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_cost DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS model_prices (
  id TEXT PRIMARY KEY,
  model_name TEXT NOT NULL,
  input_price DOUBLE PRECISION NOT NULL,
  output_price DOUBLE PRECISION NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
