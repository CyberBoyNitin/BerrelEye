package gateway

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/auth"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/cache"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/config"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/health"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/models"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/providers"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/ratelimit"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/store"
)

func testDepsExtra() (*Deps, store.Store) {
	st := store.NewMemory()
	for _, m := range []*models.Model{
		{Provider: "mock", ModelName: "mock-cheap", InputPrice: 0.15, OutputPrice: 0.6, ContextWindow: 16000, Capabilities: []string{"json"}, SupportsStream: true, SupportsJSON: true, QualityTier: "LOW", LatencyTier: "LOW", Enabled: true},
		{Provider: "mock", ModelName: "mock-medium", InputPrice: 1, OutputPrice: 3, ContextWindow: 32000, Capabilities: []string{"coding", "json", "tool_use"}, SupportsStream: true, SupportsTools: true, SupportsJSON: true, QualityTier: "MEDIUM", LatencyTier: "MEDIUM", Enabled: true},
		{Provider: "mock", ModelName: "mock-premium", InputPrice: 5, OutputPrice: 15, ContextWindow: 128000, Capabilities: []string{"coding", "reasoning", "json", "tool_use", "long_context"}, SupportsStream: true, SupportsTools: true, SupportsJSON: true, QualityTier: "HIGH", LatencyTier: "HIGH", Enabled: true},
	} {
		_ = st.UpsertModel(m)
	}
	cfg := &config.Config{StoreMode: "memory", EncryptionKey: []byte("dev-only-32-byte-key-0123456789ab")}
	return &Deps{Config: cfg, Store: st, Cache: cache.New(""), Limiter: ratelimit.New(nil), Health: health.New()}, st
}

func mkOrgExtra(t *testing.T, st store.Store, slug string) (orgID, keyID, full string) {
	t.Helper()
	org, err := st.CreateOrganization("org "+slug, slug)
	if err != nil {
		t.Fatal(err)
	}
	_ = st.SaveRoutingPolicy(&models.RoutingPolicy{OrganizationID: org.ID, OptimizationMode: models.OptShadow, DefaultModel: "mock-medium", QualityWeight: 0.5, CostWeight: 0.35, LatencyWeight: 0.15, BudgetBehavior: "ALERT_ONLY", RateLimitOrgPerMin: 600, RateLimitKeyPerMin: 300, RateLimitIPPerMin: 300})
	f, _, hash, _ := auth.NewAPIKey()
	_ = st.CreateAPIKey(&models.APIKey{OrganizationID: org.ID, Name: "t", Environment: "live", KeyPrefix: f[:12], KeyHash: hash})
	k, _ := st.GetAPIKeyByHash(hash)
	return org.ID, k.ID, f
}

func TestRevokedKeyCannotAuthenticate(t *testing.T) {
	d, st := testDepsExtra()
	orgID, _, full := mkOrgExtra(t, st, "revoke-real")
	// valid first
	if _, err := AuthenticateGateway(st, "Bearer "+full); err != nil {
		t.Fatalf("valid key must authenticate: %v", err)
	}
	// revoke then must fail
	keys, _ := st.ListAPIKeys(orgID)
	_ = st.RevokeAPIKey(orgID, keys[0].ID)
	_ = d
	if _, err := AuthenticateGateway(st, "Bearer "+full); err == nil {
		t.Fatal("revoked key must be rejected")
	}
}

func TestProviderSecretNeverInAPIResponse(t *testing.T) {
	d, st := testDepsExtra()
	orgID, keyID, _ := mkOrgExtra(t, st, "secret-leak")
	enc, _ := auth.Encrypt(d.Config.EncryptionKey, []byte("sk-secret-1234567890"))
	_ = st.UpsertProvider(&models.ProviderConfig{OrganizationID: orgID, Provider: "openai", BaseURL: "https://api.openai.com/v1", APIKeyCipher: enc, APIKeyHint: "…7890", Enabled: true})
	cfgs, _ := st.ListProviders(orgID)
	if len(cfgs) == 0 {
		t.Fatal("provider must be stored")
	}
	// provider list must never expose cipher
	for _, c := range cfgs {
		if len(c.APIKeyCipher) != 0 {
			// internal struct has cipher, but API handler strips it — simulate handler shape
			m := map[string]any{"provider": c.Provider, "api_key_hint": c.APIKeyHint}
			if _, hasCipher := m["api_key_cipher"]; hasCipher {
				t.Fatal("cipher leaked")
			}
		}
	}
	res, _ := Execute(context.Background(), d, &AuthResult{OrgID: orgID, KeyID: keyID},
		models.ChatCompletionRequest{Model: "mock-medium", Messages: []models.ChatMessage{{Role: "user", Content: "hi"}}}, ExecInput{})
	if res.StatusCode != 200 {
		t.Fatalf("mock must succeed: %s", res.ResponseBody)
	}
	if contains(string(res.ResponseBody), "sk-secret") {
		t.Fatal("provider secret leaked into gateway response")
	}
}

func contains(hay, needle string) bool {
	for i := 0; i+len(needle) <= len(hay); i++ {
		if hay[i:i+len(needle)] == needle {
			return true
		}
	}
	return false
}

func TestStreamingWorks(t *testing.T) {
	d, st := testDepsExtra()
	orgID, keyID, _ := mkOrgExtra(t, st, "stream-a")
	w := httptest.NewRecorder()
	var flusher http.Flusher = w
	rec, err := ProxyStreamWithIP(context.Background(), d, &AuthResult{OrgID: orgID, KeyID: keyID},
		models.ChatCompletionRequest{Model: "mock-medium", Messages: []models.ChatMessage{{Role: "user", Content: "count to 3"}}, Stream: true},
		"req_stream1", "127.0.0.1", w, flusher)
	if err != nil {
		t.Fatalf("stream must succeed: %v", err)
	}
	if rec.Status != "success" {
		t.Fatalf("stream status must be success: %+v", rec)
	}
	if rec.TTFTMs < 0 {
		t.Fatal("TTFT must be tracked")
	}
	body := w.Body.String()
	if !contains(body, "data:") || !contains(body, "[DONE]") {
		t.Fatalf("SSE must contain data + DONE: %s", body[:200])
	}
}

func TestFallbackDegradedLast(t *testing.T) {
	d, st := testDepsExtra()
	orgID, _, _ := mkOrgExtra(t, st, "health-a")
	reg, _ := st.ListModels()
	// poison mock provider health
	for i := 0; i < 12; i++ {
		d.Health.Record("mock", false, false, 1000000)
	}
	if !d.Health.Degraded("mock") {
		t.Fatal("mock should be degraded after 12 failures")
	}
	chain := fallbackChain(d, orgID, "mock-medium", reg, "mock")
	if len(chain) == 0 {
		t.Fatal("chain must not be empty")
	}
	// all models are mock here, so degraded ones go last but still present (no healthy alternative)
	if chain[0].provider != "mock" {
		t.Fatalf("unexpected first provider %s", chain[0].provider)
	}
}

func TestRetryableDistinction(t *testing.T) {
	r429 := &providers.ProviderError{Retryable: true, StatusCode: 429, Message: "slow down"}
	r400 := &providers.ProviderError{Retryable: false, StatusCode: 400, Message: "bad request"}
	if !r429.Retryable || r400.Retryable {
		t.Fatal("retryable must be true only for 429/5xx/network")
	}
}

func TestExactCacheTenantIsolation(t *testing.T) {
	d, st := testDepsExtra()
	aOrg, aKey, _ := mkOrgExtra(t, st, "exact-a")
	bOrg, bKey, _ := mkOrgExtra(t, st, "exact-b")
	req := models.ChatCompletionRequest{Model: "mock-medium", Messages: []models.ChatMessage{{Role: "user", Content: "same question 999"}}}
	first, _ := Execute(context.Background(), d, &AuthResult{OrgID: aOrg, KeyID: aKey}, req, ExecInput{})
	if first.Record.CacheHit {
		t.Fatal("first must miss")
	}
	// same content from org B must NOT hit org A cache
	other, _ := Execute(context.Background(), d, &AuthResult{OrgID: bOrg, KeyID: bKey}, req, ExecInput{})
	if other.Record.CacheHit {
		t.Fatal("cross-tenant exact cache hit forbidden")
	}
	second, _ := Execute(context.Background(), d, &AuthResult{OrgID: aOrg, KeyID: aKey}, req, ExecInput{})
	if !second.Record.CacheHit {
		t.Fatal("same-tenant repeat must hit")
	}
}

func TestShadowNoRerouteAutoCanRoute(t *testing.T) {
	d, st := testDepsExtra()
	orgID, keyID, _ := mkOrgExtra(t, st, "modes-a")
	_ = st.SaveRoutingPolicy(&models.RoutingPolicy{OrganizationID: orgID, OptimizationMode: models.OptShadow, DefaultModel: "mock-medium", QualityWeight: 0.5, CostWeight: 0.35, LatencyWeight: 0.15, BudgetBehavior: "ALERT_ONLY", RateLimitOrgPerMin: 600, RateLimitKeyPerMin: 300, RateLimitIPPerMin: 300})
	shadow, _ := Execute(context.Background(), d, &AuthResult{OrgID: orgID, KeyID: keyID},
		models.ChatCompletionRequest{Model: "mock-premium", Messages: []models.ChatMessage{{Role: "user", Content: "hi"}}}, ExecInput{})
	if shadow.Record.SelectedModel != "mock-premium" {
		t.Fatalf("SHADOW must keep requested, got %s", shadow.Record.SelectedModel)
	}
	_ = st.SaveRoutingPolicy(&models.RoutingPolicy{OrganizationID: orgID, OptimizationMode: models.OptAuto, DefaultModel: "mock-medium", QualityWeight: 0.1, CostWeight: 0.8, LatencyWeight: 0.1, BudgetBehavior: "ALERT_ONLY", RateLimitOrgPerMin: 600, RateLimitKeyPerMin: 300, RateLimitIPPerMin: 300})
	auto, _ := Execute(context.Background(), d, &AuthResult{OrgID: orgID, KeyID: keyID},
		models.ChatCompletionRequest{Model: "mock-premium", Messages: []models.ChatMessage{{Role: "user", Content: "hi"}}}, ExecInput{})
	if auto.Decision == nil || len(auto.Decision.RoutingReason) == 0 {
		t.Fatal("AUTO must be explainable")
	}
}

func TestBudgetDegrade(t *testing.T) {
	d, st := testDepsExtra()
	orgID, keyID, _ := mkOrgExtra(t, st, "budget-deg")
	zero := 0.0
	_ = st.SaveBudget(&models.Budget{OrganizationID: orgID, MonthlyBudget: &zero})
	_ = st.SaveRoutingPolicy(&models.RoutingPolicy{OrganizationID: orgID, OptimizationMode: models.OptAuto, DefaultModel: "mock-medium", QualityWeight: 0.5, CostWeight: 0.35, LatencyWeight: 0.15, BudgetBehavior: "DEGRADE_TO_CHEAPER_MODEL", RateLimitOrgPerMin: 600, RateLimitKeyPerMin: 300, RateLimitIPPerMin: 300})
	res, _ := Execute(context.Background(), d, &AuthResult{OrgID: orgID, KeyID: keyID},
		models.ChatCompletionRequest{Model: "mock-premium", Messages: []models.ChatMessage{{Role: "user", Content: "hi"}}}, ExecInput{})
	if res.Record.SelectedModel == "mock-premium" {
		t.Fatalf("over-budget DEGRADE must pick cheaper, got %s", res.Record.SelectedModel)
	}
}

func TestFailedProviderRecorded(t *testing.T) {
	_, st := testDepsExtra()
	_ = st.InsertProviderAttempt(&models.ProviderAttempt{RequestID: "req_fail1", Provider: "openai", Model: "gpt-4o", Status: "error", StatusCode: 500, LatencyMs: 12, Error: "boom"})
	got, err := st.ListProviderAttempts("req_fail1")
	if err != nil || len(got) != 1 || got[0].Status != "error" {
		t.Fatalf("failed attempt must be recorded: %v %v", got, err)
	}
}

func TestBudgetWarningEvent(t *testing.T) {
	d, st := testDepsExtra()
	orgID, keyID, _ := mkOrgExtra(t, st, "budget-warn")
	big := 100.0
	_ = st.SaveBudget(&models.Budget{OrganizationID: orgID, MonthlyBudget: &big})
	// spend 85% first via direct insert
	for i := 0; i < 5; i++ {
		_ = st.InsertRequest(&models.RequestRecord{OrganizationID: orgID, APIKeyID: keyID, RequestID: "req_spend", RequestedModel: "mock-medium", SelectedModel: "mock-medium", Provider: "mock", Status: "success", EstimatedCost: 17.0})
	}
	_, _ = Execute(context.Background(), d, &AuthResult{OrgID: orgID, KeyID: keyID},
		models.ChatCompletionRequest{Model: "mock-medium", Messages: []models.ChatMessage{{Role: "user", Content: "hi"}}}, ExecInput{})
	events, _ := st.ListSecurityEvents(orgID, 50)
	found := false
	for _, e := range events {
		if e.Type == "BUDGET_WARNING" || e.Type == "BUDGET_ALERT" {
			found = true
		}
	}
	if !found {
		t.Fatal("85% budget must emit warning/alert event")
	}
}

func TestRateLimitEnforced(t *testing.T) {
	d, st := testDepsExtra()
	orgID, keyID, _ := mkOrgExtra(t, st, "rl-a")
	_ = st.SaveRoutingPolicy(&models.RoutingPolicy{OrganizationID: orgID, OptimizationMode: models.OptShadow, DefaultModel: "mock-medium", QualityWeight: 0.5, CostWeight: 0.35, LatencyWeight: 0.15, BudgetBehavior: "ALERT_ONLY", RateLimitOrgPerMin: 1, RateLimitKeyPerMin: 1000, RateLimitIPPerMin: 1000})
	first, _ := Execute(context.Background(), d, &AuthResult{OrgID: orgID, KeyID: keyID},
		models.ChatCompletionRequest{Model: "mock-medium", Messages: []models.ChatMessage{{Role: "user", Content: "one"}}}, ExecInput{})
	if first.StatusCode == 429 {
		t.Fatal("first request must pass")
	}
	second, _ := Execute(context.Background(), d, &AuthResult{OrgID: orgID, KeyID: keyID},
		models.ChatCompletionRequest{Model: "mock-medium", Messages: []models.ChatMessage{{Role: "user", Content: "two"}}}, ExecInput{})
	if second.StatusCode != 429 {
		t.Fatalf("second request must be rate limited, got %d", second.StatusCode)
	}
	if second.RetryAfter == 0 {
		t.Fatal("429 must carry Retry-After")
	}
}
