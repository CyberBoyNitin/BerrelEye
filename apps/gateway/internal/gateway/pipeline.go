// Package gateway implements the request lifecycle:
// authenticate → validate → policy → budget → security/PII → cache →
// routing → provider exec (retry/fallback) → cost → persist → respond.
package gateway

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"io"
	"math"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/auth"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/cache"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/config"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/health"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/models"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/providers"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/ratelimit"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/routing"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/security"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/store"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/usage"
	"github.com/google/uuid"
)

// fetchEmbedding tries ML /embed, falls back to deterministic hash embedding (dim 128).
func fetchEmbedding(mlURL, text string) []float32 {
	if mlURL != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		body, _ := json.Marshal(map[string]string{"text": text})
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(mlURL, "/")+"/embed", bytes.NewReader(body))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
			if resp, err := http.DefaultClient.Do(req); err == nil {
				defer resp.Body.Close()
				var out struct {
					Embedding []float32 `json:"embedding"`
				}
				if json.NewDecoder(resp.Body).Decode(&out) == nil && len(out.Embedding) > 0 {
					return out.Embedding
				}
			}
		}
	}
	// deterministic fallback: hashed embedding dim 128, L2-normalized
	const dim = 128
	vec := make([]float32, dim)
	for i := 0; i < dim; i++ {
		h := fnv.New64a()
		_, _ = h.Write([]byte(fmt.Sprintf("%s#%d", text, i)))
		v := float64(h.Sum64()) / float64(math.MaxUint64)
		vec[i] = float32(v*2 - 1)
	}
	var norm float64
	for _, v := range vec {
		norm += float64(v * v)
	}
	norm = math.Sqrt(norm)
	if norm == 0 {
		norm = 1
	}
	for i := range vec {
		vec[i] = float32(float64(vec[i]) / norm)
	}
	return vec
}

func persistTelemetry(d *Deps, rec *models.RequestRecord, req models.ChatCompletionRequest, inTokens, outTokens int, estimated bool, inputCost, outputCost float64) {
	_ = d.Store.InsertRequestMessages(rec.OrganizationID, rec.RequestID, req.Messages)
	_ = d.Store.InsertRequestUsage(&models.RequestUsage{OrganizationID: rec.OrganizationID, RequestID: rec.RequestID, InputTokens: inTokens, OutputTokens: outTokens, TotalTokens: inTokens + outTokens, Estimated: estimated, LatencyMs: rec.LatencyMs, TTFTMs: rec.TTFTMs})
	_ = d.Store.InsertRequestCost(&models.RequestCost{OrganizationID: rec.OrganizationID, RequestID: rec.RequestID, InputCost: inputCost, OutputCost: outputCost, TotalCost: inputCost + outputCost})
}

type Deps struct {
	Config  *config.Config
	Store   store.Store
	Cache   *cache.Cache
	Limiter *ratelimit.Limiter
	Health  *health.Tracker
}

type AuthResult struct {
	OrgID  string
	KeyID  string
	KeyEnv string
	// RawKey is the incoming client bearer key (kept in memory only, never
	// persisted or logged). It lets the local-testing fallback below
	// recognize the well-known sentinel key at the upstream call site.
	RawKey string
}

// LocalTestClientKey is the well-known sentinel bearer key for local
// testing only (see prompt.md). When a request arrives with this key, the
// upstream provider call uses server-side env credentials
// (OPENAI_API_KEY, else TOGETHERAI_API_KEY) instead of the org's stored
// provider secret. All other keys keep the existing behavior untouched.
const LocalTestClientKey = "sk-mock-client-enterprise-key-123"

// upstreamKeyFor selects the credential passed into the upstream model
// completion call. Only the sentinel local-test key triggers the env
// fallback; every other caller gets the stored key unchanged.
func upstreamKeyFor(incomingClientKey, storedKey string) string {
	if auth.ConstantEqual(incomingClientKey, LocalTestClientKey) {
		if k := os.Getenv("OPENAI_API_KEY"); k != "" {
			return k
		}
		if k := os.Getenv("TOGETHERAI_API_KEY"); k != "" {
			return k
		}
	}
	return storedKey
}

// providerEnvKey returns the server-side env credential for a provider,
// mirroring the keys documented in .env (empty in local dev). Providers
// without an env-backed credential (e.g. mock, which never calls the
// network) return "".
func providerEnvKey(provider string) string {
	switch provider {
	case "openai":
		return os.Getenv("OPENAI_API_KEY")
	case "anthropic":
		return os.Getenv("ANTHROPIC_API_KEY")
	case "compat":
		if k := os.Getenv("OPENAI_COMPAT_API_KEY"); k != "" {
			return k
		}
		return os.Getenv("TOGETHERAI_API_KEY")
	default:
		return ""
	}
}

// simulatedLocalResult implements the Testing Isolation Layer (prompt.md):
// when the incoming client key is the local-test sentinel AND the requested
// provider has no env credential configured, the upstream network call is
// skipped and a simulated successful local response is returned so the full
// pipeline (auth → routing → cost → dashboard) is exercisable for free.
// Usage is word-estimated (Estimated=true) like the mock provider. It
// returns nil for every other caller, which always hits live providers.
func simulatedLocalResult(incomingClientKey, provider, model string, messages []models.ChatMessage) *providers.Result {
	if provider == "mock" || !auth.ConstantEqual(incomingClientKey, LocalTestClientKey) || providerEnvKey(provider) != "" {
		return nil
	}
	reply := fmt.Sprintf("Universal Gateway Success: Live pipeline verified for model %s.", model)
	joined := ""
	for _, m := range messages {
		joined += m.Content + "\n"
	}
	return &providers.Result{Content: reply, InputTokens: providers.EstimateTokens(joined),
		OutputTokens: providers.EstimateTokens(reply), Estimated: true, FinishReason: "stop"}
}

func AuthenticateGateway(s store.Store, header string) (*AuthResult, error) {
	if !strings.HasPrefix(header, "Bearer ") {
		return nil, fmt.Errorf("missing bearer key")
	}
	full := strings.TrimPrefix(header, "Bearer ")
	k, err := s.GetAPIKeyByHash(auth.HashKey(full))
	if err != nil || k.RevokedAt != nil {
		return nil, fmt.Errorf("invalid api key")
	}
	_ = s.TouchAPIKey(k.ID)
	return &AuthResult{OrgID: k.OrganizationID, KeyID: k.ID, KeyEnv: k.Environment, RawKey: full}, nil
}

type ExecInput struct {
	RawBody     []byte
	NoStore     bool
	RequestID   string
	Idempotency string
	ClientIP    string
}

type ExecResult struct {
	StatusCode    int
	ResponseBody  []byte // non-streaming JSON
	Stream        bool
	Record        *models.RequestRecord
	Decision      *models.RoutingDecision
	SecurityNotes []string
	RetryAfter    int
}

// Execute runs the full lifecycle for a chat-completions request.
// For stream=true the provider call runs with emit callbacks supplied by
// the HTTP layer (see api package); this function performs detection,
// routing, budget, non-stream execution and persistence.
func Execute(ctx context.Context, d *Deps, a *AuthResult, req models.ChatCompletionRequest, in ExecInput) (*ExecResult, error) {
	start := time.Now()
	requestID := in.RequestID
	if requestID == "" {
		requestID = "req_" + uuid.NewString()[:12]
	}

	policy, err := d.Store.GetRoutingPolicy(a.OrgID)
	if err != nil {
		return nil, err
	}

	// --- validation ---
	if len(req.Messages) == 0 {
		return errResult(a, requestID, req, policy, "invalid_request", "messages must not be empty", 400), nil
	}
	model := req.Model
	if model == "" || model == "auto" {
		model = policy.DefaultModel
	}

	// --- rate limit (configurable per org, plus IP + provider) ---
	orgLimit, keyLimit, ipLimit := policy.RateLimitOrgPerMin, policy.RateLimitKeyPerMin, policy.RateLimitIPPerMin
	if orgLimit <= 0 {
		orgLimit = 600
	}
	if keyLimit <= 0 {
		keyLimit = 300
	}
	if ipLimit <= 0 {
		ipLimit = 300
	}
	rateLimited := !d.Limiter.Allow(ctx, "org:"+a.OrgID, orgLimit) || !d.Limiter.Allow(ctx, "key:"+a.KeyID, keyLimit)
	if in.ClientIP != "" && !rateLimited {
		rateLimited = !d.Limiter.Allow(ctx, "ip:"+in.ClientIP, ipLimit)
	}
	if rateLimited {
		_ = d.Store.InsertSecurityEvent(&models.SecurityEvent{OrganizationID: a.OrgID, RequestID: requestID, Type: "RATE_LIMITED", Detail: "gateway rate limit exceeded"})
		r := errResult(a, requestID, req, policy, "rate_limited", "Rate limit exceeded. Retry after 60s.", 429)
		r.RetryAfter = 60
		return r, nil
	}

	// --- security: PII detection over joined content ---
	tokenizer := security.NewTokenizer()
	joined := ""
	for _, m := range req.Messages {
		joined += "\n" + m.Content
	}
	findings := security.Detect(joined)
	piiTypes := map[string]int{}
	hasSecret := false
	for _, f := range findings {
		if f.Type == "secret" {
			hasSecret = true
		} else {
			piiTypes[f.Type]++
		}
	}
	if len(findings) > 0 {
		detail := fmt.Sprintf("detected=%d", len(findings))
		_ = d.Store.InsertSecurityEvent(&models.SecurityEvent{OrganizationID: a.OrgID, RequestID: requestID, Type: "PII_DETECTED", Detail: detail})
		if hasSecret {
			_ = d.Store.InsertSecurityEvent(&models.SecurityEvent{OrganizationID: a.OrgID, RequestID: requestID, Type: "SECRET_DETECTED", Detail: "request contained a secret-like pattern"})
		}
		// Tokenize user content before sending upstream.
		for i := range req.Messages {
			if req.Messages[i].Role == "user" || req.Messages[i].Role == "system" {
				req.Messages[i].Content = tokenizer.Tokenize(req.Messages[i].Content, findings)
			}
		}
	}

	// --- cache eligibility + exact lookup + semantic lookup ---
	bodyMap := map[string]any{"model": req.Model, "temperature": req.Temperature}
	hasTools := req.Tools != nil
	eligible := cache.Eligible(in.NoStore, hasTools, bodyMap) && !req.Stream
	sysHash := hashStr(systemPrompt(req.Messages))
	paramsHash := hashStr(fmt.Sprintf("%v|%v", req.Temperature, req.MaxTokens))
	normMsgs, _ := json.Marshal(req.Messages)

	var servedFromCache string
	var servedCacheType string
	var currentEmbedding []float32
	if eligible {
		key := cache.ExactKey(a.OrgID, model, sysHash, paramsHash, string(normMsgs))
		if v, ok := d.Cache.Get(ctx, key); ok {
			servedFromCache = v
			servedCacheType = "exact"
			_ = d.Store.RecordCacheLookup(a.OrgID, true)
		} else {
			_ = d.Store.RecordCacheLookup(a.OrgID, false)
			// semantic cache: opt-in + threshold + compatible params + no tools
			if policy.SemanticCache && policy.SemanticThreshold > 0 && !hasTools && in.NoStore == false {
				embedText := systemPrompt(req.Messages) + "\x00" + string(normMsgs)
				currentEmbedding = fetchEmbedding(d.Config.MLServiceURL, embedText)
				if resp, _, score, err := d.Store.SemanticSearch(a.OrgID, "chat", currentEmbedding, policy.SemanticThreshold, 1); err == nil && resp != "" {
					servedFromCache = resp
					servedCacheType = fmt.Sprintf("semantic:%.2f", score)
					_ = d.Store.RecordCacheLookup(a.OrgID, true)
				}
			}
		}
	}

	// --- routing analysis (always computed for explainability) ---
	registry, _ := d.Store.ListModels()
	decision := routing.Select(policy, model, req.Messages, req.Tools, req.ResponseFormat, registry, routing.RuleClassifier{})
	if policy.OptimizationMode == "OFF" {
		decision.SelectedModel = model
		decision.Reasons = append([]string{"optimization OFF: explicit model choice respected"}, decision.Reasons...)
	}

	// --- budget enforcement with 80%/90%/100% thresholds ---
	budget, _ := d.Store.GetBudget(a.OrgID)
	if budget != nil {
		now := time.Now().UTC()
		monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
		monthSpend, _ := d.Store.SpendSince(a.OrgID, monthStart)
		daySpend, _ := d.Store.SpendSince(a.OrgID, dayStart)
		over := func(limit *float64, spend float64) bool { return limit != nil && spend >= *limit }
		ratio := func(limit *float64, spend float64) float64 {
			if limit == nil || *limit <= 0 {
				return 0
			}
			return spend / *limit
		}
		mRatio := math.Max(ratio(budget.MonthlyBudget, monthSpend), ratio(budget.DailyBudget, daySpend))
		if mRatio >= 0.8 && mRatio < 0.9 {
			_ = d.Store.InsertSecurityEvent(&models.SecurityEvent{OrganizationID: a.OrgID, RequestID: requestID, Type: "BUDGET_WARNING", Detail: fmt.Sprintf("budget %.0f%% consumed", mRatio*100)})
			_ = d.Store.CreateAlert(&models.Alert{OrganizationID: a.OrgID, Type: "BUDGET_WARNING", Threshold: 0.8, Channel: "dashboard", Enabled: true, Message: fmt.Sprintf("Budget %.0f%% consumed", mRatio*100)})
		} else if mRatio >= 0.9 && mRatio < 1.0 {
			_ = d.Store.InsertSecurityEvent(&models.SecurityEvent{OrganizationID: a.OrgID, RequestID: requestID, Type: "BUDGET_ALERT", Detail: fmt.Sprintf("budget %.0f%% consumed", mRatio*100)})
			_ = d.Store.CreateAlert(&models.Alert{OrganizationID: a.OrgID, Type: "BUDGET_ALERT", Threshold: 0.9, Channel: "dashboard", Enabled: true, Message: fmt.Sprintf("Budget %.0f%% consumed", mRatio*100)})
		}
		if over(budget.MonthlyBudget, monthSpend) || over(budget.DailyBudget, daySpend) {
			switch policy.BudgetBehavior {
			case "BLOCK":
				_ = d.Store.InsertSecurityEvent(&models.SecurityEvent{OrganizationID: a.OrgID, RequestID: requestID, Type: "POLICY_VIOLATION", Detail: "budget exceeded; request blocked"})
				return errResult(a, requestID, req, policy, "budget_exceeded", "Organization budget exceeded.", 402), nil
			case "DEGRADE_TO_CHEAPER_MODEL":
				decision.SelectedModel = cheapest(registry)
				decision.Reasons = append(decision.Reasons, "budget exceeded: degraded to cheapest model")
			default:
				_ = d.Store.InsertSecurityEvent(&models.SecurityEvent{OrganizationID: a.OrgID, RequestID: requestID, Type: "BUDGET_EXCEEDED", Detail: "budget 100% consumed; ALERT_ONLY, request allowed"})
			}
		}
		if budget.PerRequestLimit != nil {
			if est := estimateCost(req.Messages, decision.SelectedModel, registry); est > *budget.PerRequestLimit {
				_ = d.Store.InsertSecurityEvent(&models.SecurityEvent{OrganizationID: a.OrgID, RequestID: requestID, Type: "POLICY_VIOLATION", Detail: "per-request limit exceeded"})
				return errResult(a, requestID, req, policy, "budget_exceeded", "Estimated request cost exceeds per-request limit.", 402), nil
			}
		}
	}

	selected := decision.SelectedModel
	if servedFromCache != "" {
		ct := servedCacheType
		if ct == "" {
			ct = "exact"
		}
		rec := &models.RequestRecord{OrganizationID: a.OrgID, APIKeyID: a.KeyID, RequestID: requestID,
			RequestedModel: req.Model, SelectedModel: selected, Provider: providerFor(selected, registry),
			Status: "success", InputTokens: 0, OutputTokens: 0, TotalTokens: 0, EstimatedCost: 0,
			LatencyMs: time.Since(start).Milliseconds(), CacheHit: true, CacheType: ct, RoutingMode: string(policy.OptimizationMode),
			RoutingReason: decision.Reasons}
		_ = d.Store.InsertRequest(rec)
		persistTelemetry(d, rec, req, 0, 0, false, 0, 0)
		_ = d.Store.InsertRoutingDecision(&models.RoutingDecision{OrganizationID: a.OrgID, RequestID: requestID,
			RequestedModel: req.Model, RecommendedModel: decision.RecommendedModel, SelectedModel: selected,
			ActualCost: 0, EstimatedOptimized: 0, EstimatedSavings: 0, RoutingReason: decision.Reasons, Category: decision.Category})
		cachedResp := tokenizer.Restore(servedFromCache)
		return &ExecResult{StatusCode: 200, ResponseBody: []byte(cachedResp), Record: rec,
			Decision: &models.RoutingDecision{RecommendedModel: decision.RecommendedModel, RoutingReason: decision.Reasons}}, nil
	}

	// --- provider execution with retry + fallback ---
	params := toParams(req)
	prov, _, _ := resolveProvider(d, a.OrgID, selected, registry)
	chain := fallbackChain(d, a.OrgID, selected, registry, prov)
	var (
		res       *providers.Result
		usedProv  = prov
		usedModel = selected
		attempts  []attemptInfo
	)
	for i, link := range chain {
		if sim := simulatedLocalResult(a.RawKey, link.provider, link.model, req.Messages); sim != nil {
			// Testing Isolation Layer: skip the upstream network call.
			res = sim
			usedProv, usedModel = link.provider, link.model
			attempts = append(attempts, attemptInfo{link.provider, link.model, "success", 200, 0, ""})
			_ = d.Store.InsertProviderAttempt(&models.ProviderAttempt{RequestID: requestID, Provider: link.provider, Model: link.model, Status: "success", StatusCode: 200, LatencyMs: 0})
			break
		}
		p := providers.Get(link.provider)
		t0 := time.Now()
		// Defensive local-testing fallback (prompt.md): the sentinel client
		// key swaps the upstream credential for env-provided ones.
		r, err := p.ChatCompletion(ctx, link.model, req.Messages, params, upstreamKeyFor(a.RawKey, link.apiKey), link.baseURL)
		lat := time.Since(t0)
		if d.Health != nil {
			pe, _ := err.(*providers.ProviderError)
			d.Health.Record(link.provider, err == nil, err != nil && pe != nil && pe.StatusCode == 429, lat)
		}
		st, code := "success", 200
		msg := ""
		if err != nil {
			st, msg = "error", err.Error()
			if pe, ok := err.(*providers.ProviderError); ok {
				code = pe.StatusCode
				if pe.Retryable && i < len(chain)-1 {
					// exponential backoff + jitter before next link
					backoff := time.Duration(200*(1<<i)) * time.Millisecond
					backoff += time.Duration(rand.Int63n(150)) * time.Millisecond
					select {
					case <-ctx.Done():
						break
					case <-time.After(backoff):
					}
				}
			}
			attempts = append(attempts, attemptInfo{link.provider, link.model, st, code, lat.Milliseconds(), msg})
			_ = d.Store.InsertProviderAttempt(&models.ProviderAttempt{RequestID: requestID, Provider: link.provider, Model: link.model, Status: st, StatusCode: code, LatencyMs: lat.Milliseconds(), Error: msg})
			continue
		}
		res = r
		usedProv, usedModel = link.provider, link.model
		attempts = append(attempts, attemptInfo{link.provider, link.model, st, code, lat.Milliseconds(), ""})
		_ = d.Store.InsertProviderAttempt(&models.ProviderAttempt{RequestID: requestID, Provider: link.provider, Model: link.model, Status: st, StatusCode: code, LatencyMs: lat.Milliseconds()})
		break
	}
	_ = attempts
	if res == nil {
		rec := &models.RequestRecord{OrganizationID: a.OrgID, APIKeyID: a.KeyID, RequestID: requestID,
			RequestedModel: req.Model, SelectedModel: selected, Provider: usedProv, Status: "error",
			Error: "The upstream provider is temporarily unavailable.", LatencyMs: time.Since(start).Milliseconds(),
			RoutingMode: string(policy.OptimizationMode), RoutingReason: decision.Reasons}
		_ = d.Store.InsertRequest(rec)
		persistTelemetry(d, rec, req, 0, 0, true, 0, 0)
		body, _ := json.Marshal(map[string]any{"error": map[string]any{"type": "provider_error", "message": "The upstream provider is temporarily unavailable.", "request_id": requestID}})
		return &ExecResult{StatusCode: 502, ResponseBody: body, Record: rec}, nil
	}

	content := tokenizer.Restore(res.Content)

	// --- cost ---
	regModel, _ := lookupModel(registry, usedModel)
	cost := usage.Calculate(res.InputTokens, res.OutputTokens, regModel)
	// shadow/recommend analysis: what would the recommended model have cost
	// for the same token counts (estimate, clearly labeled in dashboard).
	recModel, _ := lookupModel(registry, decision.RecommendedModel)
	optCost := usage.Calculate(res.InputTokens, res.OutputTokens, recModel)
	inputCost := 0.0
	outputCost := 0.0
	if regModel != nil {
		inputCost = float64(res.InputTokens) / 1e6 * regModel.InputPrice
		outputCost = float64(res.OutputTokens) / 1e6 * regModel.OutputPrice
	}

	rec := &models.RequestRecord{OrganizationID: a.OrgID, APIKeyID: a.KeyID, RequestID: requestID,
		RequestedModel: req.Model, SelectedModel: usedModel, Provider: usedProv, Status: "success",
		InputTokens: res.InputTokens, OutputTokens: res.OutputTokens, TotalTokens: res.InputTokens + res.OutputTokens,
		EstimatedCost: cost, LatencyMs: time.Since(start).Milliseconds(), CacheHit: false,
		RoutingMode: string(policy.OptimizationMode), RoutingReason: decision.Reasons}
	_ = d.Store.InsertRequest(rec)
	persistTelemetry(d, rec, req, res.InputTokens, res.OutputTokens, res.Estimated, inputCost, outputCost)
	rd := &models.RoutingDecision{OrganizationID: a.OrgID, RequestID: requestID, RequestedModel: req.Model,
		RecommendedModel: decision.RecommendedModel, SelectedModel: usedModel, ActualCost: cost,
		EstimatedOptimized: optCost, EstimatedSavings: cost - optCost, RoutingReason: decision.Reasons, Category: decision.Category}
	_ = d.Store.InsertRoutingDecision(rd)

	// --- populate exact + semantic cache for future hits ---
	if eligible {
		key := cache.ExactKey(a.OrgID, model, sysHash, paramsHash, string(normMsgs))
		respJSON, _ := json.Marshal(openAIEnvelope(requestID, usedModel, content, res))
		ttl := time.Duration(policy.CacheTTLSeconds) * time.Second
		if ttl <= 0 {
			ttl = time.Hour
		}
		d.Cache.Set(ctx, key, string(respJSON), ttl)
		emb := currentEmbedding
		if emb == nil {
			embedText := systemPrompt(req.Messages) + "\x00" + string(normMsgs)
			emb = fetchEmbedding(d.Config.MLServiceURL, embedText)
		}
		_ = d.Store.UpsertCacheEntry(a.OrgID, key, "chat", sysHash, paramsHash, string(respJSON), emb, time.Now().Add(ttl))
	}

	body, _ := json.Marshal(openAIEnvelope(requestID, usedModel, content, res))
	return &ExecResult{StatusCode: 200, ResponseBody: body, Record: rec, Decision: rd}, nil
}

type attemptInfo struct {
	provider string
	model    string
	status   string
	code     int
	latMs    int64
	err      string
}

type providerLink struct {
	provider string
	model    string
	apiKey   string
	baseURL  string
}

func resolveProvider(d *Deps, orgID, selected string, registry []*models.Model) (string, string, string) {
	m, _ := lookupModel(registry, selected)
	prov := "mock"
	if m != nil {
		prov = m.Provider
	}
	key, base := providerCreds(d, orgID, prov)
	return prov, key, base
}

func fallbackChain(d *Deps, orgID, selected string, registry []*models.Model, first string) []providerLink {
	healthy := []providerLink{}
	degraded := []providerLink{}
	seen := map[string]bool{}
	add := func(model string) {
		if seen[model] {
			return
		}
		seen[model] = true
		m, err := lookupModel(registry, model)
		if err != nil || m == nil {
			return
		}
		key, base := providerCreds(d, orgID, m.Provider)
		link := providerLink{provider: m.Provider, model: m.ModelName, apiKey: key, baseURL: base}
		if d.Health != nil && d.Health.Degraded(m.Provider) {
			degraded = append(degraded, link)
			return
		}
		healthy = append(healthy, link)
	}
	add(selected)
	// capability-compatible fallbacks, cheapest first
	for _, m := range registry {
		if m.ModelName != selected {
			add(m.ModelName)
		}
		if len(healthy)+len(degraded) >= 3 {
			break
		}
	}
	return append(healthy, degraded...)
}

func providerCreds(d *Deps, orgID, provider string) (string, string) {
	defBase := map[string]string{
		"openai": d.Config.OpenAIBaseURL, "anthropic": d.Config.AnthropicBaseURL,
		"compat": d.Config.CompatBaseURL, "mock": "",
	}
	base := defBase[provider]
	key := ""
	if cfgs, err := d.Store.ListProviders(orgID); err == nil {
		for _, c := range cfgs {
			if c.Provider == provider && c.Enabled {
				if len(c.APIKeyCipher) > 0 {
					if pt, err := auth.Decrypt(d.Config.EncryptionKey, c.APIKeyCipher); err == nil {
						key = string(pt)
					}
				}
				if c.BaseURL != "" {
					base = c.BaseURL
				}
				break
			}
		}
	}
	return key, base
}

func lookupModel(registry []*models.Model, name string) (*models.Model, error) {
	for _, m := range registry {
		if m.ModelName == name {
			return m, nil
		}
	}
	return nil, fmt.Errorf("model not found")
}

func providerFor(model string, registry []*models.Model) string {
	if m, err := lookupModel(registry, model); err == nil && m != nil {
		return m.Provider
	}
	return "mock"
}

func cheapest(registry []*models.Model) string {
	best := ""
	bestCost := 1e18
	for _, m := range registry {
		c := (m.InputPrice + m.OutputPrice) / 2
		if c < bestCost {
			bestCost, best = c, m.ModelName
		}
	}
	return best
}

func estimateCost(msgs []models.ChatMessage, model string, registry []*models.Model) float64 {
	m, err := lookupModel(registry, model)
	if err != nil || m == nil {
		return 0
	}
	joined := ""
	for _, m := range msgs {
		joined += m.Content + "\n"
	}
	in := providers.EstimateTokens(joined)
	return usage.Calculate(in, 500, m)
}

func toParams(req models.ChatCompletionRequest) providers.Params {
	maxTok := req.MaxTokens
	if maxTok == nil {
		maxTok = req.MaxCompletionTokens
	}
	return providers.Params{Temperature: req.Temperature, MaxTokens: maxTok, Stop: req.Stop, ResponseFormat: req.ResponseFormat, Tools: req.Tools, Stream: req.Stream}
}

func systemPrompt(ms []models.ChatMessage) string {
	for _, m := range ms {
		if m.Role == "system" {
			return m.Content
		}
	}
	return ""
}

func hashStr(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

func errResult(a *AuthResult, requestID string, req models.ChatCompletionRequest, policy *models.RoutingPolicy, typ, msg string, code int) *ExecResult {
	body, _ := json.Marshal(map[string]any{"error": map[string]any{"type": typ, "message": msg, "request_id": requestID}})
	return &ExecResult{StatusCode: code, ResponseBody: body}
}

func openAIEnvelope(requestID, model, content string, res *providers.Result) map[string]any {
	return map[string]any{
		"id": requestID, "object": "chat.completion", "created": time.Now().Unix(), "model": model,
		"choices": []any{map[string]any{"index": 0, "message": map[string]any{"role": "assistant", "content": content}, "finish_reason": res.FinishReason}},
		"usage":   map[string]any{"prompt_tokens": res.InputTokens, "completion_tokens": res.OutputTokens, "total_tokens": res.InputTokens + res.OutputTokens},
	}
}

// ProxyStream executes a streaming provider call while forwarding SSE chunks.
// Used by the HTTP layer for stream=true requests.
func ProxyStream(ctx context.Context, d *Deps, a *AuthResult, req models.ChatCompletionRequest, requestID string, w http.ResponseWriter, flusher http.Flusher) (*models.RequestRecord, error) {
	return ProxyStreamWithIP(ctx, d, a, req, requestID, "", w, flusher)
}

func ProxyStreamWithIP(ctx context.Context, d *Deps, a *AuthResult, req models.ChatCompletionRequest, requestID, clientIP string, w http.ResponseWriter, flusher http.Flusher) (*models.RequestRecord, error) {
	start := time.Now()
	policy, _ := d.Store.GetRoutingPolicy(a.OrgID)
	if len(req.Messages) == 0 {
		rec := &models.RequestRecord{OrganizationID: a.OrgID, APIKeyID: a.KeyID, RequestID: requestID, RequestedModel: req.Model, SelectedModel: req.Model, Provider: "none", Status: "error", Error: "messages must not be empty", LatencyMs: 0, RoutingMode: string(policy.OptimizationMode)}
		_ = d.Store.InsertRequest(rec)
		return rec, fmt.Errorf("messages must not be empty")
	}
	// rate limiting (same policy as non-stream)
	orgLimit, keyLimit, ipLimit := policy.RateLimitOrgPerMin, policy.RateLimitKeyPerMin, policy.RateLimitIPPerMin
	if orgLimit <= 0 {
		orgLimit = 600
	}
	if keyLimit <= 0 {
		keyLimit = 300
	}
	if ipLimit <= 0 {
		ipLimit = 300
	}
	if !d.Limiter.Allow(ctx, "org:"+a.OrgID, orgLimit) || !d.Limiter.Allow(ctx, "key:"+a.KeyID, keyLimit) || (clientIP != "" && !d.Limiter.Allow(ctx, "ip:"+clientIP, ipLimit)) {
		_ = d.Store.InsertSecurityEvent(&models.SecurityEvent{OrganizationID: a.OrgID, RequestID: requestID, Type: "RATE_LIMITED", Detail: "streaming rate limit exceeded"})
		rec := &models.RequestRecord{OrganizationID: a.OrgID, APIKeyID: a.KeyID, RequestID: requestID, RequestedModel: req.Model, SelectedModel: req.Model, Provider: "none", Status: "error", Error: "Rate limit exceeded.", LatencyMs: time.Since(start).Milliseconds(), RoutingMode: string(policy.OptimizationMode)}
		_ = d.Store.InsertRequest(rec)
		return rec, fmt.Errorf("rate_limited")
	}
	model := req.Model
	if model == "" || model == "auto" {
		model = policy.DefaultModel
	}
	registry, _ := d.Store.ListModels()
	decision := routing.Select(policy, model, req.Messages, req.Tools, req.ResponseFormat, registry, routing.RuleClassifier{})
	selected := decision.SelectedModel
	if policy.OptimizationMode == "OFF" {
		selected = model
	}
	// PII detection for streaming too (tokenize before upstream)
	tokenizer := security.NewTokenizer()
	joined := ""
	for _, m := range req.Messages {
		joined += "\n" + m.Content
	}
	if findings := security.Detect(joined); len(findings) > 0 {
		_ = d.Store.InsertSecurityEvent(&models.SecurityEvent{OrganizationID: a.OrgID, RequestID: requestID, Type: "PII_DETECTED", Detail: fmt.Sprintf("detected=%d", len(findings))})
		for i := range req.Messages {
			if req.Messages[i].Role == "user" || req.Messages[i].Role == "system" {
				req.Messages[i].Content = tokenizer.Tokenize(req.Messages[i].Content, findings)
			}
		}
	}
	prov, apiKey, baseURL := resolveProvider(d, a.OrgID, selected, registry)
	p := providers.Get(prov)
	ttft := int64(-1)
	var sb bytes.Buffer
	// Defensive local-testing fallback (prompt.md): the sentinel client key
	// swaps the upstream credential for env-provided ones.
	emit := func(ch providers.StreamChunk) error {
		if ttft < 0 {
			ttft = time.Since(start).Milliseconds()
		}
		if ch.Done {
			_, _ = io.WriteString(w, "data: [DONE]\n\n")
			flusher.Flush()
			return nil
		}
		sb.WriteString(ch.Delta)
		payload, _ := json.Marshal(map[string]any{
			"id": requestID, "object": "chat.completion.chunk", "created": time.Now().Unix(), "model": selected,
			"choices": []any{map[string]any{"index": 0, "delta": map[string]any{"content": ch.Delta}, "finish_reason": nil}},
		})
		_, _ = io.WriteString(w, "data: "+string(payload)+"\n\n")
		flusher.Flush()
		return nil
	}
	var (
		res *providers.Result
		err error
	)
	if sim := simulatedLocalResult(a.RawKey, prov, selected, req.Messages); sim != nil {
		// Testing Isolation Layer: replay the simulated content through the
		// identical SSE framing without any upstream network call.
		if err = emit(providers.StreamChunk{Delta: sim.Content}); err == nil {
			err = emit(providers.StreamChunk{Done: true, InputTokens: sim.InputTokens, OutputTokens: sim.OutputTokens, Estimated: true})
		}
		res = sim
	} else {
		res, err = p.StreamChatCompletion(ctx, selected, req.Messages, toParams(req), upstreamKeyFor(a.RawKey, apiKey), baseURL, emit)
	}
	if ttft < 0 {
		ttft = time.Since(start).Milliseconds()
	}
	rec := &models.RequestRecord{OrganizationID: a.OrgID, APIKeyID: a.KeyID, RequestID: requestID,
		RequestedModel: req.Model, SelectedModel: selected, Provider: prov,
		RoutingMode: string(policy.OptimizationMode), RoutingReason: decision.Reasons, TTFTMs: ttft,
		LatencyMs: time.Since(start).Milliseconds()}
	if err != nil {
		rec.Status = "error"
		rec.Error = "The upstream provider is temporarily unavailable."
		_ = d.Store.InsertRequest(rec)
		persistTelemetry(d, rec, req, 0, 0, true, 0, 0)
		return rec, err
	}
	restored := tokenizer.Restore(sb.String())
	_ = restored
	m, _ := lookupModel(registry, selected)
	cost := usage.Calculate(res.InputTokens, res.OutputTokens, m)
	inputCost := 0.0
	outputCost := 0.0
	if m != nil {
		inputCost = float64(res.InputTokens) / 1e6 * m.InputPrice
		outputCost = float64(res.OutputTokens) / 1e6 * m.OutputPrice
	}
	rec.Status = "success"
	rec.InputTokens, rec.OutputTokens, rec.TotalTokens = res.InputTokens, res.OutputTokens, res.InputTokens+res.OutputTokens
	rec.EstimatedCost = cost
	_ = d.Store.InsertRequest(rec)
	persistTelemetry(d, rec, req, res.InputTokens, res.OutputTokens, res.Estimated, inputCost, outputCost)
	_ = d.Store.InsertProviderAttempt(&models.ProviderAttempt{RequestID: requestID, Provider: prov, Model: selected, Status: "success", StatusCode: 200, LatencyMs: rec.LatencyMs})
	recModel, _ := lookupModel(registry, decision.RecommendedModel)
	optCost := usage.Calculate(res.InputTokens, res.OutputTokens, recModel)
	_ = d.Store.InsertRoutingDecision(&models.RoutingDecision{OrganizationID: a.OrgID, RequestID: requestID, RequestedModel: req.Model,
		RecommendedModel: decision.RecommendedModel, SelectedModel: selected, ActualCost: cost,
		EstimatedOptimized: optCost, EstimatedSavings: cost - optCost, RoutingReason: decision.Reasons, Category: decision.Category})
	return rec, nil
}
