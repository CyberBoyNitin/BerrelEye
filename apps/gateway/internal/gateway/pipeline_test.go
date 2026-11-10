package gateway

import (
	"context"
	"testing"
	"time"

	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/auth"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/cache"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/config"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/health"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/models"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/ratelimit"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/store"
)

func testDeps() (*Deps, store.Store) {
	st := store.NewMemory()
	for _, m := range []*models.Model{
		{Provider: "mock", ModelName: "mock-cheap", InputPrice: 0.15, OutputPrice: 0.6, ContextWindow: 16000, Capabilities: []string{"json"}, SupportsStream: true, SupportsJSON: true, QualityTier: "LOW", LatencyTier: "LOW", Enabled: true},
		{Provider: "mock", ModelName: "mock-medium", InputPrice: 1, OutputPrice: 3, ContextWindow: 32000, Capabilities: []string{"coding", "json", "tool_use"}, SupportsStream: true, SupportsTools: true, SupportsJSON: true, QualityTier: "MEDIUM", LatencyTier: "MEDIUM", Enabled: true},
	} {
		_ = st.UpsertModel(m)
	}
	cfg := &config.Config{StoreMode: "memory", EncryptionKey: []byte("dev-only-32-byte-key-0123456789ab")}
	return &Deps{Config: cfg, Store: st, Cache: cache.New(""), Limiter: ratelimit.New(nil), Health: health.New()}, st
}

func mkOrg(t *testing.T, st store.Store, slug string) (orgID, keyID string) {
	t.Helper()
	org, err := st.CreateOrganization("org "+slug, slug)
	if err != nil {
		t.Fatal(err)
	}
	_ = st.SaveRoutingPolicy(&models.RoutingPolicy{OrganizationID: org.ID, OptimizationMode: models.OptAuto, DefaultModel: "mock-medium", QualityWeight: 0.5, CostWeight: 0.35, LatencyWeight: 0.15, BudgetBehavior: "ALERT_ONLY"})
	full, _, hash, _ := auth.NewAPIKey()
	_ = st.CreateAPIKey(&models.APIKey{OrganizationID: org.ID, Name: "t", Environment: "live", KeyPrefix: full[:12], KeyHash: hash})
	k, _ := st.GetAPIKeyByHash(hash)
	return org.ID, k.ID
}

func TestExecuteEndToEndMock(t *testing.T) {
	d, _ := testDeps()
	orgID, keyID := mkOrg(t, d.Store, "e2e-a")
	res, err := Execute(context.Background(), d, &AuthResult{OrgID: orgID, KeyID: keyID},
		models.ChatCompletionRequest{Model: "mock-medium", Messages: []models.ChatMessage{{Role: "user", Content: "Hello"}}}, ExecInput{})
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 {
		t.Fatalf("status=%d body=%s", res.StatusCode, res.ResponseBody)
	}
	if res.Record.EstimatedCost <= 0 {
		t.Fatal("cost must be calculated")
	}
	if res.Record.TotalTokens == 0 {
		t.Fatal("tokens must be tracked")
	}
	// dashboard reflects the row
	got, err := d.Store.GetRequest(orgID, res.Record.ID)
	if err != nil || got.EstimatedCost != res.Record.EstimatedCost {
		t.Fatalf("dashboard must reflect DB record: %v", err)
	}
}

func TestTenantIsolation(t *testing.T) {
	d, _ := testDeps()
	aOrg, aKey := mkOrg(t, d.Store, "tenant-a")
	bOrg, bKey := mkOrg(t, d.Store, "tenant-b")
	ra, _ := Execute(context.Background(), d, &AuthResult{OrgID: aOrg, KeyID: aKey},
		models.ChatCompletionRequest{Model: "mock-medium", Messages: []models.ChatMessage{{Role: "user", Content: "A secret"}}}, ExecInput{})
	_, _ = Execute(context.Background(), d, &AuthResult{OrgID: bOrg, KeyID: bKey},
		models.ChatCompletionRequest{Model: "mock-medium", Messages: []models.ChatMessage{{Role: "user", Content: "B data"}}}, ExecInput{})
	if _, err := d.Store.GetRequest(bOrg, ra.Record.ID); err == nil {
		t.Fatal("tenant B must not read tenant A request")
	}
	listB, total, _ := d.Store.ListRequests(bOrg, 50, 0)
	if total != 1 || listB[0].OrganizationID != bOrg {
		t.Fatal("tenant listing leaked across orgs")
	}
}

func TestRevokedKeyRejected(t *testing.T) {
	_, st := testDeps()
	orgID, keyID := mkOrg(t, st, "revoke-a")
	keys, _ := st.ListAPIKeys(orgID)
	_ = keyID
	_ = st.RevokeAPIKey(orgID, keys[0].ID)
	k, _ := st.GetAPIKeyByHash(keys[0].KeyHash)
	if k.RevokedAt == nil {
		t.Fatal("revoked key must carry revoked_at")
	}
	if _, err := AuthenticateGateway(st, "Bearer "+"sk_live_invalid"); err == nil {
		t.Fatal("invalid key must be rejected")
	}
}

func TestExplicitChoiceRespectedWhenOff(t *testing.T) {
	d, st := testDeps()
	orgID, keyID := mkOrg(t, st, "off-a")
	_ = st.SaveRoutingPolicy(&models.RoutingPolicy{OrganizationID: orgID, OptimizationMode: models.OptOff, DefaultModel: "mock-cheap", QualityWeight: 0.5, CostWeight: 0.35, LatencyWeight: 0.15, BudgetBehavior: "ALERT_ONLY"})
	res, _ := Execute(context.Background(), d, &AuthResult{OrgID: orgID, KeyID: keyID},
		models.ChatCompletionRequest{Model: "mock-medium", Messages: []models.ChatMessage{{Role: "user", Content: "hi"}}}, ExecInput{})
	if res.Record.SelectedModel != "mock-medium" {
		t.Fatalf("OFF must respect explicit choice, got %s", res.Record.SelectedModel)
	}
}

func TestBudgetBlock(t *testing.T) {
	d, st := testDeps()
	orgID, keyID := mkOrg(t, st, "budget-a")
	zero := 0.0
	_ = st.SaveBudget(&models.Budget{OrganizationID: orgID, MonthlyBudget: &zero})
	_ = st.SaveRoutingPolicy(&models.RoutingPolicy{OrganizationID: orgID, OptimizationMode: models.OptAuto, DefaultModel: "mock-medium", QualityWeight: 0.5, CostWeight: 0.35, LatencyWeight: 0.15, BudgetBehavior: "BLOCK"})
	res, _ := Execute(context.Background(), d, &AuthResult{OrgID: orgID, KeyID: keyID},
		models.ChatCompletionRequest{Model: "mock-medium", Messages: []models.ChatMessage{{Role: "user", Content: "hi"}}}, ExecInput{})
	if res.StatusCode != 402 {
		t.Fatalf("over-budget BLOCK must return 402, got %d", res.StatusCode)
	}
}

func TestCacheHitSecondRequest(t *testing.T) {
	d, _ := testDeps()
	orgID, keyID := mkOrg(t, d.Store, "cache-a")
	req := models.ChatCompletionRequest{Model: "mock-medium", Messages: []models.ChatMessage{{Role: "user", Content: "repeatable question"}}}
	first, _ := Execute(context.Background(), d, &AuthResult{OrgID: orgID, KeyID: keyID}, req, ExecInput{})
	if first.Record.CacheHit {
		t.Fatal("first request must be a miss")
	}
	second, _ := Execute(context.Background(), d, &AuthResult{OrgID: orgID, KeyID: keyID}, req, ExecInput{})
	if !second.Record.CacheHit {
		t.Fatal("identical second request must hit exact cache")
	}
}

func tomorrow() time.Time { return time.Now().Add(24 * time.Hour) }

func TestSemanticCacheIsolatedPerTenant(t *testing.T) {
	st := store.NewMemory()
	_ = st.UpsertCacheEntry("org-a", "k1", "chat", "", "", "resp-a", []float32{1, 0}, tomorrow())
	if _, _, _, err := st.SemanticSearch("org-b", "chat", []float32{1, 0}, 0.9, 1); err == nil {
		t.Fatal("org B must never retrieve org A cache")
	}
}
