// Shared types between gateway (Go) and web (TS). Source of truth for
// dashboard API shapes. Keep in sync with apps/gateway/internal/models.
export type OptimizationMode = "OFF" | "SHADOW" | "RECOMMEND" | "AUTO";

export interface RequestRecord {
  id: string; organization_id: string; request_id: string;
  requested_model: string; selected_model: string; provider: string;
  status: string; error?: string;
  input_tokens: number; output_tokens: number; total_tokens: number;
  estimated_provider_cost: number; latency_ms: number;
  time_to_first_token_ms: number; cache_hit: boolean; cache_type?: string;
  routing_mode: OptimizationMode; routing_reason?: string[]; created_at: string;
}

export interface RoutingDecision {
  requested_model: string; recommended_model: string; selected_model: string;
  actual_cost: number; estimated_optimized_cost: number; estimated_savings: number;
  routing_reason: string[]; category: string;
}

export interface Overview {
  total_spend: number; estimated_optimized_spend: number;
  potential_savings: number; requests: number; tokens: number;
  cache_hit_rate: number; avg_latency_ms: number;
  provider_success_rate: number; // -1 when no data
}
