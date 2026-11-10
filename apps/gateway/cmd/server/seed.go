package main

import (
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/auth"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/config"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/gateway"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/models"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/store"
)

// Seed installs the model registry always, plus a demo org with sample
// telemetry when SEED_DEMO=true. Demo rows are real DB rows scoped to the
// demo org — never mixed into other tenants.
func Seed(st store.Store, demo bool) {
	registry := []*models.Model{
		{Provider: "mock", ModelName: "mock-cheap", InputPrice: 0.15, OutputPrice: 0.60, ContextWindow: 16000, Capabilities: []string{"json"}, SupportsStream: true, SupportsTools: false, SupportsJSON: true, QualityTier: "LOW", LatencyTier: "LOW", Enabled: true},
		{Provider: "mock", ModelName: "mock-medium", InputPrice: 1.00, OutputPrice: 3.00, ContextWindow: 32000, Capabilities: []string{"coding", "json", "tool_use"}, SupportsStream: true, SupportsTools: true, SupportsJSON: true, QualityTier: "MEDIUM", LatencyTier: "MEDIUM", Enabled: true},
		{Provider: "mock", ModelName: "mock-premium", InputPrice: 5.00, OutputPrice: 15.00, ContextWindow: 128000, Capabilities: []string{"coding", "reasoning", "json", "tool_use", "long_context"}, SupportsStream: true, SupportsTools: true, SupportsJSON: true, QualityTier: "HIGH", LatencyTier: "HIGH", Enabled: true},
		{Provider: "openai", ModelName: "gpt-4o-mini", InputPrice: 0.15, OutputPrice: 0.60, ContextWindow: 128000, Capabilities: []string{"coding", "json", "tool_use"}, SupportsStream: true, SupportsTools: true, SupportsJSON: true, QualityTier: "MEDIUM", LatencyTier: "LOW", Enabled: true},
		{Provider: "openai", ModelName: "gpt-4o", InputPrice: 2.50, OutputPrice: 10.00, ContextWindow: 128000, Capabilities: []string{"coding", "reasoning", "json", "tool_use", "long_context"}, SupportsStream: true, SupportsTools: true, SupportsJSON: true, QualityTier: "HIGH", LatencyTier: "MEDIUM", Enabled: true},
		{Provider: "anthropic", ModelName: "claude-3-5-sonnet", InputPrice: 3.00, OutputPrice: 15.00, ContextWindow: 200000, Capabilities: []string{"coding", "reasoning", "json", "tool_use", "long_context"}, SupportsStream: true, SupportsTools: true, SupportsJSON: true, QualityTier: "HIGH", LatencyTier: "MEDIUM", Enabled: true},
		{Provider: "compat", ModelName: "compat-cheap", InputPrice: 0.10, OutputPrice: 0.30, ContextWindow: 32000, Capabilities: []string{"json"}, SupportsStream: true, SupportsTools: false, SupportsJSON: true, QualityTier: "LOW", LatencyTier: "LOW", Enabled: true},
	}
	for _, m := range registry {
		_ = st.UpsertModel(m)
	}
	if !demo {
		return
	}
	pw, _ := auth.HashPassword("demo1234!")
	u, err := st.CreateUser("demo@berreleye.dev", pw)
	if err != nil {
		if u, err = st.GetUserByEmail("demo@berreleye.dev"); err != nil {
			return
		}
	}
	org, err := st.CreateOrganization("Demo Org", "demo")
	if err != nil {
		return
	}
	_ = st.AddMembership(org.ID, u.ID, "admin")
	_ = st.SaveRoutingPolicy(&models.RoutingPolicy{OrganizationID: org.ID, OptimizationMode: models.OptShadow,
		DefaultModel: "mock-medium", QualityWeight: 0.5, CostWeight: 0.35, LatencyWeight: 0.15,
		SemanticCache: false, SemanticThreshold: 0.92, CacheTTLSeconds: 3600, BudgetBehavior: "ALERT_ONLY",
		RateLimitOrgPerMin: 600, RateLimitKeyPerMin: 300, RateLimitIPPerMin: 300})
	// Local-testing sentinel key (prompt.md): registered for the demo org so
	// a test client presenting this bearer passes the normal auth path, at
	// which point upstream calls use OPENAI_API_KEY/TOGETHERAI_API_KEY env
	// credentials. Demo seed only; idempotent across reboots.
	if _, err := st.GetAPIKeyByHash(auth.HashKey(gateway.LocalTestClientKey)); err != nil {
		_ = st.CreateAPIKey(&models.APIKey{OrganizationID: org.ID, Name: "local-test-sentinel",
			Environment: "test", KeyPrefix: gateway.LocalTestClientKey[:12],
			KeyHash:     auth.HashKey(gateway.LocalTestClientKey),
			Permissions: "gateway:chat"})
	}
	_, _, _ = u, org, err
}

var _ = config.Load
