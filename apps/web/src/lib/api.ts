// BerrelEye dashboard API client.
//
// All dashboard data comes from the Go gateway over HTTP with a session
// cookie (credentials: "include"). Never hard-code metrics in pages —
// fetch here, render loading skeletons, empty states, and error states.
//
// Base URL: process.env.NEXT_PUBLIC_API_URL (default http://localhost:8080).
// Server-side gateway URL (docker compose) is GATEWAY_INTERNAL_URL, but the
// browser must use NEXT_PUBLIC_API_URL.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8080";

export class ApiError extends Error {
  status: number;
  body: string;
  path: string;
  constructor(status: number, body: string, path: string) {
    super(`Gateway request failed (${status}) at ${path}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.path = path;
  }
}

type FetchOptions = Omit<RequestInit, "credentials"> & {
  credentials?: RequestCredentials;
};

export async function apiFetch<T>(
  path: string,
  init: FetchOptions = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      credentials: init.credentials ?? "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
  } catch (err) {
    throw new Error(
      `Cannot reach gateway at ${API_BASE}${path}. Is the gateway running? (${err instanceof Error ? err.message : String(err)})`
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text.slice(0, 2000), path);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Gateway returned non-JSON at ${path}: ${text.slice(0, 200)}`);
  }
}

/** Try multiple candidate paths in order; return first 2xx result. */
export async function apiFetchFirst<T>(paths: string[], init: FetchOptions = {}): Promise<{ data: T; path: string }> {
  let lastErr: unknown = null;
  for (const p of paths) {
    try {
      const data = await apiFetch<T>(p, init);
      return { data, path: p };
    } catch (err) {
      // Only fall through on 404 (endpoint not implemented under that name).
      // Auth errors (401/403) and connection errors are load-bearing.
      if (err instanceof ApiError && err.status !== 404) throw err;
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`No gateway endpoint responded for: ${paths.join(", ")}`);
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

// ---------------------------------------------------------------------------
// Types (mirror apps/gateway/internal/models/models.go + dashboard aggregates)
// ---------------------------------------------------------------------------

export interface MeResponse {
  user: { id: string; email: string; created_at?: string };
  organization: { id: string; name: string; slug: string };
}

export interface OverviewResponse {
  total_spend: number;
  estimated_optimized_spend: number;
  potential_savings: number;
  savings_pct: number;
  requests: number;
  tokens: number;
  cache_hit_rate: number;
  avg_latency_ms: number;
  success_rate: number;
  cache_hits?: number;
  cache_misses?: number;
  estimated_actual_savings?: number;
  spend_by_day?: { date: string; spend: number }[];
  savings_by_source?: { source: string; amount: number }[];
}

export interface RequestRow {
  id: string;
  request_id: string;
  requested_model: string;
  selected_model: string;
  provider: string;
  status: string;
  error?: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_provider_cost: number;
  latency_ms: number;
  time_to_first_token_ms?: number;
  cache_hit: boolean;
  cache_type?: string;
  routing_mode: string;
  routing_reason?: string[];
  created_at: string;
}

export interface RequestsResponse {
  data: RequestRow[];
  total: number;
}

export interface RoutingDecision {
  id: string;
  request_id: string;
  requested_model: string;
  recommended_model: string;
  selected_model: string;
  actual_cost: number;
  estimated_optimized_cost: number;
  estimated_savings: number;
  routing_reason: string[];
  category: string;
  created_at: string;
}

export interface ProviderAttempt {
  id: string;
  request_id: string;
  provider: string;
  model: string;
  status: string;
  status_code: number;
  latency_ms: number;
  error?: string;
}

export interface RequestDetailResponse {
  request: RequestRow;
  routing_decision?: RoutingDecision | null;
  provider_attempts?: ProviderAttempt[];
  security_events?: SecurityEvent[];
}

export interface ModelStat {
  model: string;
  provider?: string;
  requests: number;
  tokens: number;
  cost: number;
  avg_latency_ms: number;
  error_rate: number;
  recommended_model?: string;
  potential_cost_difference?: number;
}

export interface ModelsResponse {
  data: ModelStat[];
}

export interface SecurityEvent {
  id: string;
  organization_id?: string;
  request_id?: string;
  type: string;
  detail: string;
  created_at: string;
}

export interface SecurityEventsResponse {
  data: SecurityEvent[];
  total: number;
}

export interface SecuritySummary {
  pii_detections: number;
  secret_detections: number;
  blocked_requests: number;
  rate_limit_events: number;
  policy_violations: number;
  invalid_api_key_events?: number;
  suspicious_requests?: number;
}

export interface GatewayApiKey {
  id: string;
  organization_id?: string;
  name: string;
  environment: string;
  key_prefix: string;
  permissions?: string;
  created_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
  /** Full secret — present ONLY in the create response, never afterwards. */
  key?: string;
}

export interface KeysResponse {
  data: GatewayApiKey[];
}

export interface OrgSettings {
  organization?: { id: string; name: string; slug: string };
  routing_policy?: {
    optimization_mode: "OFF" | "SHADOW" | "RECOMMEND" | "AUTO";
    default_model: string;
    quality_weight: number;
    cost_weight: number;
    latency_weight: number;
    semantic_cache_enabled: boolean;
    semantic_threshold: number;
    cache_ttl_seconds: number;
    budget_behavior: string;
    rate_limit_org_per_min?: number;
    rate_limit_key_per_min?: number;
    rate_limit_ip_per_min?: number;
  };
  budgets?: {
    monthly_budget?: number | null;
    daily_budget?: number | null;
    per_request_limit?: number | null;
  };
}

// ---------------------------------------------------------------------------
// Endpoint groups (ordered fallbacks so the dashboard survives gateway
// renames; primary name first).
// ---------------------------------------------------------------------------

export const ENDPOINTS = {
  me: ["/api/auth/me"],
  login: ["/api/auth/login"],
  signup: ["/api/auth/signup"],
  logout: ["/api/auth/logout"],
  overview: ["/api/dashboard/overview", "/api/analytics/overview", "/api/overview"],
  requests: ["/api/dashboard/requests", "/api/requests"],
  requestDetail: (id: string) => [`/api/dashboard/requests/${id}`, `/api/requests/${id}`],
  models: ["/api/dashboard/models", "/api/analytics/models", "/api/models"],
  providers: ["/api/providers", "/api/dashboard/providers"],
  providerAnalytics: ["/api/analytics/providers"],
  cacheAnalytics: ["/api/analytics/cache"],
  securitySummary: [
    "/api/dashboard/security",
    "/api/security/summary",
    "/api/security/events/summary",
  ],
  securityEvents: ["/api/dashboard/security/events", "/api/security/events"],
  keys: ["/api/keys", "/api/dashboard/keys"],
  settings: [
    "/api/settings",
    "/api/dashboard/settings",
    "/api/organizations/me/settings",
    "/api/routing/policy",
  ],
  members: ["/api/members"],
  audit: ["/api/audit", "/api/dashboard/audit"],
  alerts: ["/api/alerts"],
  onboarding: ["/api/onboarding"],
  routing: ["/api/routing", "/api/routing/policy"],
  budgets: ["/api/budgets"],
} as const;

export interface ProviderConfig {
  id: string;
  provider: string;
  name: string;
  base_url: string;
  api_key_hint: string;
  dev_only: boolean;
  enabled: boolean;
  success_rate?: number;
}

export interface MemberRow {
  id: string;
  user_id: string;
  email: string;
  role: string;
  organization_id: string;
}

export interface AuditRow {
  id: string;
  organization_id: string;
  actor: string;
  action: string;
  metadata: string;
  created_at: string;
}

export interface AlertRow {
  id: string;
  organization_id: string;
  type: string;
  threshold: number;
  channel: string;
  enabled: boolean;
  message: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Auth helpers (session cookie via gateway)
// ---------------------------------------------------------------------------

export async function login(email: string, password: string): Promise<MeResponse | unknown> {
  const { data } = await apiFetchFirst<MeResponse>([...ENDPOINTS.login], {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return data;
}

export async function signup(email: string, password: string, orgName: string): Promise<MeResponse | unknown> {
  const { data } = await apiFetchFirst<MeResponse>([...ENDPOINTS.signup], {
    method: "POST",
    body: JSON.stringify({ email, password, org_name: orgName, organization_name: orgName }),
  });
  return data;
}

export async function logout(): Promise<void> {
  try {
    await apiFetchFirst<unknown>([...ENDPOINTS.logout], { method: "POST", body: JSON.stringify({}) });
  } catch {
    // Logout is best-effort: even if the gateway is down, drop local state.
  }
}

export async function getMe(): Promise<MeResponse> {
  const { data } = await apiFetchFirst<MeResponse>([...ENDPOINTS.me]);
  return data;
}
