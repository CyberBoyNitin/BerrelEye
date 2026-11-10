package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/auth"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/models"
)

// ---------- dashboard auth ----------

func (s *Server) setSession(w http.ResponseWriter, userID, orgID string) {
	tok, hash, _ := auth.NewSessionToken()
	_ = s.store.CreateSession(userID, orgID, hash, time.Now().Add(7*24*time.Hour))
	http.SetCookie(w, &http.Cookie{Name: "berreleye_session", Value: tok, Path: "/", HttpOnly: true, Secure: s.cfg.SecureCookies, SameSite: http.SameSiteLaxMode, MaxAge: 7 * 24 * 3600})
}

func (s *Server) audit(orgID, actor, action, meta string) {
	_ = s.store.InsertAudit(&models.AuditLog{OrganizationID: orgID, Actor: actor, Action: action, Metadata: meta})
}

func (s *Server) handleSignup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, r, 405, "method_not_allowed", "Use POST.")
		return
	}
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		OrgName  string `json:"org_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Email == "" || len(body.Password) < 8 {
		writeErr(w, r, 400, "invalid_request", "Email and password (min 8 chars) required.")
		return
	}
	if _, err := s.store.GetUserByEmail(body.Email); err == nil {
		writeErr(w, r, 409, "conflict", "Email already registered.")
		return
	}
	hash, _ := auth.HashPassword(body.Password)
	u, err := s.store.CreateUser(body.Email, hash)
	if err != nil {
		writeErr(w, r, 500, "internal", "Could not create user.")
		return
	}
	orgName := body.OrgName
	if orgName == "" {
		orgName = strings.Split(body.Email, "@")[0] + "'s org"
	}
	slug := strings.ToLower(strings.ReplaceAll(strings.Split(body.Email, "@")[0], ".", "-")) + "-" + strconv.FormatInt(time.Now().Unix()%10000, 10)
	org, err := s.store.CreateOrganization(orgName, slug)
	if err != nil {
		writeErr(w, r, 500, "internal", "Could not create organization.")
		return
	}
	_ = s.store.AddMembership(org.ID, u.ID, "admin")
	_ = s.store.SaveRoutingPolicy(defaultPolicyFor(org.ID))
	s.setSession(w, u.ID, org.ID)
	s.audit(org.ID, u.Email, "signup", "")
	writeJSON(w, 201, map[string]any{"user": map[string]any{"id": u.ID, "email": u.Email}, "organization": org})
}

func defaultPolicyFor(orgID string) *models.RoutingPolicy {
	return &models.RoutingPolicy{OrganizationID: orgID, OptimizationMode: models.OptShadow, DefaultModel: "mock-medium",
		QualityWeight: 0.5, CostWeight: 0.35, LatencyWeight: 0.15, SemanticCache: false, SemanticThreshold: 0.92,
		CacheTTLSeconds: 3600, BudgetBehavior: "ALERT_ONLY",
		RateLimitOrgPerMin: 600, RateLimitKeyPerMin: 300, RateLimitIPPerMin: 300}
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, r, 405, "method_not_allowed", "Use POST.")
		return
	}
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, r, 400, "invalid_request", "Malformed JSON.")
		return
	}
	u, err := s.store.GetUserByEmail(body.Email)
	if err != nil || !auth.CheckPassword(u.PasswordHash, body.Password) {
		writeErr(w, r, 401, "invalid_credentials", "Invalid email or password.")
		return
	}
	orgs, _ := s.store.ListOrganizationsForUser(u.ID)
	orgID := ""
	if len(orgs) > 0 {
		orgID = orgs[0].ID
	}
	s.setSession(w, u.ID, orgID)
	s.audit(orgID, u.Email, "login", "")
	writeJSON(w, 200, map[string]any{"user": map[string]any{"id": u.ID, "email": u.Email}, "organizations": orgs})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie("berreleye_session"); err == nil {
		_ = s.store.DeleteSession(sha256hex(c.Value))
	}
	http.SetCookie(w, &http.Cookie{Name: "berreleye_session", Value: "", Path: "/", MaxAge: -1})
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	u, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	user, _ := s.store.GetUser(u)
	orgs, _ := s.store.ListOrganizationsForUser(u)
	var cur any
	for _, org := range orgs {
		if org.ID == o {
			cur = org
			break
		}
	}
	if cur == nil && len(orgs) > 0 {
		cur = orgs[0]
	}
	// superset shape: supports both legacy (organization_id) and frontend (organization)
	writeJSON(w, 200, map[string]any{"user": map[string]any{"id": user.ID, "email": user.Email}, "organization": cur, "organization_id": o, "organizations": orgs})
}

// ---------- api keys ----------

func (s *Server) handleKeys(w http.ResponseWriter, r *http.Request) {
	u, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		keys, _ := s.store.ListAPIKeys(o)
		out := []any{}
		for _, k := range keys {
			out = append(out, map[string]any{"id": k.ID, "name": k.Name, "environment": k.Environment, "key_prefix": k.KeyPrefix,
				"created_at": k.CreatedAt, "last_used_at": k.LastUsedAt, "revoked_at": k.RevokedAt})
		}
		if out == nil {
			out = []any{}
		}
		writeJSON(w, 200, map[string]any{"data": out})
	case http.MethodPost:
		var body struct {
			Name        string `json:"name"`
			Environment string `json:"environment"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Name == "" {
			body.Name = "default"
		}
		if body.Environment == "" {
			body.Environment = "live"
		}
		full, prefix, hash, _ := auth.NewAPIKey()
		k := &models.APIKey{OrganizationID: o, Name: body.Name, Environment: body.Environment, KeyPrefix: prefix, KeyHash: hash, Permissions: "gateway:chat"}
		if err := s.store.CreateAPIKey(k); err != nil {
			writeErr(w, r, 500, "internal", "Could not create key.")
			return
		}
		user, _ := s.store.GetUser(u)
		s.audit(o, user.Email, "api_key.create", k.ID)
		// Full key shown exactly once.
		writeJSON(w, 201, map[string]any{"id": k.ID, "key": full, "key_prefix": prefix, "warning": "Copy this key now. It will never be shown again."})
	default:
		writeErr(w, r, 405, "method_not_allowed", "Use GET/POST.")
	}
}

func (s *Server) handleKeyByID(w http.ResponseWriter, r *http.Request) {
	u, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/keys/")
	if r.Method != http.MethodDelete {
		writeErr(w, r, 405, "method_not_allowed", "Use DELETE to revoke.")
		return
	}
	if err := s.store.RevokeAPIKey(o, id); err != nil {
		writeErr(w, r, 404, "not_found", "Key not found.")
		return
	}
	user, _ := s.store.GetUser(u)
	s.audit(o, user.Email, "api_key.revoke", id)
	writeJSON(w, 200, map[string]any{"ok": true})
}

// ---------- providers (never return raw secrets) ----------

func (s *Server) handleProviders(w http.ResponseWriter, r *http.Request) {
	u, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		cfgs, _ := s.store.ListProviders(o)
		out := []any{}
		for _, c := range cfgs {
			rate := -1.0
			if s.health != nil {
				rate = s.health.SuccessRate(c.Provider)
			}
			out = append(out, map[string]any{"id": c.ID, "provider": c.Provider, "name": c.Name, "base_url": c.BaseURL,
				"api_key_hint": c.APIKeyHint, "dev_only": c.DevOnly, "enabled": c.Enabled, "success_rate": rate})
		}
		if out == nil {
			out = []any{}
		}
		writeJSON(w, 200, map[string]any{"data": out})
	case http.MethodPost:
		var body struct {
			Provider string `json:"provider"`
			Name     string `json:"name"`
			BaseURL  string `json:"base_url"`
			APIKey   string `json:"api_key"`
			Enabled  *bool  `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Provider == "" {
			writeErr(w, r, 400, "invalid_request", "provider is required.")
			return
		}
		enc, err := auth.Encrypt(s.cfg.EncryptionKey, []byte(body.APIKey))
		if err != nil {
			writeErr(w, r, 500, "internal", "Could not store credentials.")
			return
		}
		enabled := true
		if body.Enabled != nil {
			enabled = *body.Enabled
		}
		hint := ""
		if len(body.APIKey) > 4 {
			hint = "…" + body.APIKey[len(body.APIKey)-4:]
		}
		c := &models.ProviderConfig{OrganizationID: o, Provider: body.Provider, Name: body.Name, BaseURL: body.BaseURL,
			APIKeyCipher: enc, APIKeyHint: hint, DevOnly: auth.DevOnly(s.cfg.EncryptionKey), Enabled: enabled}
		if err := s.store.UpsertProvider(c); err != nil {
			writeErr(w, r, 500, "internal", "Could not save provider.")
			return
		}
		user, _ := s.store.GetUser(u)
		s.audit(o, user.Email, "provider.create", body.Provider)
		writeJSON(w, 201, map[string]any{"id": c.ID, "provider": c.Provider, "api_key_hint": hint, "dev_only": c.DevOnly})
	default:
		writeErr(w, r, 405, "method_not_allowed", "Use GET/POST.")
	}
}

func (s *Server) handleProviderByID(w http.ResponseWriter, r *http.Request) {
	_, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/providers/")
	if r.Method != http.MethodDelete {
		writeErr(w, r, 405, "method_not_allowed", "Use DELETE.")
		return
	}
	_ = s.store.DeleteProvider(o, id)
	writeJSON(w, 200, map[string]any{"ok": true})
}

// ---------- models / routing / budgets ----------

func (s *Server) handleRegistry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, r, 405, "method_not_allowed", "Use GET.")
		return
	}
	if _, _, ok := s.requireSession(w, r); !ok {
		return
	}
	list, _ := s.store.ListModels()
	if list == nil {
		list = []*models.Model{}
	}
	writeJSON(w, 200, map[string]any{"data": list})
}

func (s *Server) handleRouting(w http.ResponseWriter, r *http.Request) {
	u, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	if r.Method == http.MethodGet {
		p, _ := s.store.GetRoutingPolicy(o)
		writeJSON(w, 200, p)
		return
	}
	if r.Method == http.MethodPut {
		var p models.RoutingPolicy
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			writeErr(w, r, 400, "invalid_request", "Malformed JSON.")
			return
		}
		p.OrganizationID = o
		switch p.OptimizationMode {
		case models.OptOff, models.OptShadow, models.OptRecommend, models.OptAuto:
		default:
			writeErr(w, r, 400, "invalid_request", "optimization_mode must be OFF|SHADOW|RECOMMEND|AUTO.")
			return
		}
		if err := s.store.SaveRoutingPolicy(&p); err != nil {
			writeErr(w, r, 500, "internal", "Could not save policy.")
			return
		}
		user, _ := s.store.GetUser(u)
		s.audit(o, user.Email, "routing_policy.update", string(p.OptimizationMode))
		writeJSON(w, 200, &p)
		return
	}
	writeErr(w, r, 405, "method_not_allowed", "Use GET/PUT.")
}

// ---------- requests explorer ----------

func (s *Server) handleRequests(w http.ResponseWriter, r *http.Request) {
	_, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	if r.Method != http.MethodGet {
		writeErr(w, r, 405, "method_not_allowed", "Use GET.")
		return
	}
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	offset, _ := strconv.Atoi(q.Get("offset"))
	list, total, err := s.store.ListRequests(o, limit, offset)
	if err != nil {
		writeErr(w, r, 500, "internal", "Could not list requests.")
		return
	}
	if list == nil {
		list = []*models.RequestRecord{}
	}
	writeJSON(w, 200, map[string]any{"data": list, "total": total})
}

func (s *Server) handleRequestDetail(w http.ResponseWriter, r *http.Request) {
	_, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/requests/")
	rec, err := s.store.GetRequest(o, id)
	if err != nil {
		writeErr(w, r, 404, "not_found", "Request not found.")
		return
	}
	decision, _ := s.store.GetRoutingDecisionByRequest(o, rec.RequestID)
	attempts, _ := s.store.ListProviderAttempts(rec.RequestID)
	events, _ := s.store.ListSecurityEvents(o, 100)
	var reqEvents []any
	for _, e := range events {
		if e.RequestID == rec.RequestID {
			reqEvents = append(reqEvents, map[string]any{"type": e.Type, "detail": e.Detail, "created_at": e.CreatedAt})
		}
	}
	if reqEvents == nil {
		reqEvents = []any{}
	}
	if attempts == nil {
		attempts = []*models.ProviderAttempt{}
	}
	writeJSON(w, 200, map[string]any{"request": rec, "routing_decision": decision, "provider_attempts": attempts, "security_events": reqEvents})
}

// ---------- analytics (all from real DB rows) ----------

func (s *Server) handleOverview(w http.ResponseWriter, r *http.Request) {
	_, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	list, total, _ := s.store.ListRequests(o, 100000, 0)
	var tokens int64
	var spendF, optSpendF float64
	var latSum int64
	var latN, cacheHits, success int64
	var decisionsEST float64
	var cacheSaved float64
	byDay := map[string]float64{}
	bySource := map[string]float64{"routing": 0, "caching": 0, "provider_selection": 0, "model_selection": 0}
	for _, rec := range list {
		tokens += int64(rec.TotalTokens)
		spendF += rec.EstimatedCost
		latSum += rec.LatencyMs
		latN++
		if rec.CacheHit {
			cacheHits++
			cacheSaved += rec.EstimatedCost
		}
		if rec.Status == "success" {
			success++
		}
		day := rec.CreatedAt.Format("2006-01-02")
		byDay[day] += rec.EstimatedCost
		if d, err := s.store.GetRoutingDecisionByRequest(o, rec.RequestID); err == nil && d != nil {
			optSpendF += d.EstimatedOptimized
			sav := d.EstimatedSavings
			if sav < 0 {
				sav = 0
			}
			decisionsEST += sav
			bySource["routing"] += sav
			bySource["model_selection"] += sav * 0.5
			bySource["provider_selection"] += sav * 0.5
		} else {
			optSpendF += rec.EstimatedCost
		}
	}
	bySource["caching"] = cacheSaved
	hitRate := 0.0
	if total > 0 {
		hitRate = float64(cacheHits) / float64(total)
	}
	avgLat := 0.0
	if latN > 0 {
		avgLat = float64(latSum) / float64(latN)
	}
	successRate := -1.0
	if total > 0 {
		successRate = float64(success) / float64(total)
	}
	potential := spendF - optSpendF
	if potential < 0 {
		potential = 0
	}
	savingsPct := 0.0
	if spendF > 0 {
		savingsPct = potential / spendF
	}
	spendByDay := []any{}
	for d, v := range byDay {
		spendByDay = append(spendByDay, map[string]any{"date": d, "spend": v})
	}
	savingsBySource := []any{}
	for src, amt := range bySource {
		savingsBySource = append(savingsBySource, map[string]any{"source": src, "amount": amt})
	}
	writeJSON(w, 200, map[string]any{
		"total_spend": spendF, "estimated_optimized_spend": optSpendF,
		"potential_savings": potential, "potential_monthly_savings": potential,
		"savings_pct": savingsPct, "estimated_actual_savings": cacheSaved,
		"requests": total, "tokens": tokens, "cache_hit_rate": hitRate,
		"cache_hits": cacheHits, "cache_misses": int64(total) - cacheHits,
		"avg_latency_ms": avgLat, "provider_success_rate": successRate, "success_rate": successRate,
		"estimated_savings_from_routing": decisionsEST,
		"spend_by_day":                   spendByDay, "savings_by_source": savingsBySource,
		"note": "Potential savings are estimates from shadow/auto analysis, not actual money saved.",
	})
}

func (s *Server) handleModelAnalytics(w http.ResponseWriter, r *http.Request) {
	_, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	list, _, _ := s.store.ListRequests(o, 100000, 0)
	byModel := map[string]map[string]any{}
	latSum := map[string]int64{}
	provFor := map[string]string{}
	for _, rec := range list {
		key := rec.SelectedModel
		rw, exists := byModel[key]
		if !exists {
			rw = map[string]any{"model": rec.SelectedModel, "provider": rec.Provider, "requests": 0, "tokens": 0, "cost": 0.0, "errors": 0, "error_rate": 0.0}
			byModel[key] = rw
		}
		rw["requests"] = rw["requests"].(int) + 1
		rw["tokens"] = rw["tokens"].(int) + rec.TotalTokens
		rw["cost"] = rw["cost"].(float64) + rec.EstimatedCost
		latSum[key] += rec.LatencyMs
		provFor[key] = rec.Provider
		if rec.Status != "success" {
			rw["errors"] = rw["errors"].(int) + 1
		}
		if d, err := s.store.GetRoutingDecisionByRequest(o, rec.RequestID); err == nil && d != nil {
			rw["recommended_model"] = d.RecommendedModel
			rw["recommended"] = d.RecommendedModel
			prev := 0.0
			if v, ok := rw["potential_cost_difference"].(float64); ok {
				prev = v
			} else if v, ok := rw["potential_savings"].(float64); ok {
				prev = v
			}
			rw["potential_cost_difference"] = prev + d.EstimatedSavings
			rw["potential_savings"] = prev + d.EstimatedSavings
		}
	}
	out := []any{}
	for m, rw := range byModel {
		reqs := rw["requests"].(int)
		if reqs > 0 {
			rw["avg_latency_ms"] = float64(latSum[m]) / float64(reqs)
			rw["error_rate"] = float64(rw["errors"].(int)) / float64(reqs)
		}
		rw["provider"] = provFor[m]
		out = append(out, rw)
	}
	if out == nil {
		out = []any{}
	}
	writeJSON(w, 200, map[string]any{"data": out})
}

func (s *Server) handleProviderAnalytics(w http.ResponseWriter, r *http.Request) {
	_, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	list, _, _ := s.store.ListRequests(o, 100000, 0)
	type row struct {
		Provider    string  `json:"provider"`
		Spend       float64 `json:"spend"`
		Requests    int     `json:"requests"`
		SuccessRate float64 `json:"success_rate"`
		AvgLatency  float64 `json:"avg_latency_ms"`
		Errors      int     `json:"errors"`
	}
	byP := map[string]*row{}
	latSum := map[string]int64{}
	for _, rec := range list {
		rw := byP[rec.Provider]
		if rw == nil {
			rw = &row{Provider: rec.Provider}
			byP[rec.Provider] = rw
		}
		rw.Requests++
		rw.Spend += rec.EstimatedCost
		latSum[rec.Provider] += rec.LatencyMs
		if rec.Status != "success" {
			rw.Errors++
		}
	}
	out := []any{}
	for p, rw := range byP {
		if rw.Requests > 0 {
			rw.AvgLatency = float64(latSum[p]) / float64(rw.Requests)
			rw.SuccessRate = float64(rw.Requests-rw.Errors) / float64(rw.Requests)
		}
		out = append(out, rw)
	}
	if out == nil {
		out = []any{}
	}
	writeJSON(w, 200, map[string]any{"data": out})
}

func (s *Server) handleCacheAnalytics(w http.ResponseWriter, r *http.Request) {
	_, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	list, _, _ := s.store.ListRequests(o, 100000, 0)
	var hits int64
	var saved float64
	for _, rec := range list {
		if rec.CacheHit {
			hits++
			saved += rec.EstimatedCost // avoided provider cost is $0 actual; report separately
		}
	}
	total := int64(len(list))
	rate := 0.0
	if total > 0 {
		rate = float64(hits) / float64(total)
	}
	writeJSON(w, 200, map[string]any{"requests": total, "hits": hits, "misses": total - hits,
		"hit_rate": rate, "note": "Cache saves provider spend; reported as avoided cost, not money saved."})
}

func (s *Server) handleSecurityEvents(w http.ResponseWriter, r *http.Request) {
	_, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	events, _ := s.store.ListSecurityEvents(o, 200)
	counts, _ := s.store.SecurityCounts(o, time.Now().Add(-24*time.Hour))
	if events == nil {
		events = []*models.SecurityEvent{}
	}
	if counts == nil {
		counts = map[string]int{}
	}
	writeJSON(w, 200, map[string]any{"data": events, "counts_24h": counts,
		"wording": "Counts show requests containing detected PII patterns, not confirmed leaks prevented."})
}

func (s *Server) handleBudgets(w http.ResponseWriter, r *http.Request) {
	u, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	if r.Method == http.MethodGet {
		b, _ := s.store.GetBudget(o)
		writeJSON(w, 200, b)
		return
	}
	if r.Method == http.MethodPut {
		var b models.Budget
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeErr(w, r, 400, "invalid_request", "Malformed JSON.")
			return
		}
		b.OrganizationID = o
		_ = s.store.SaveBudget(&b)
		user, _ := s.store.GetUser(u)
		s.audit(o, user.Email, "budget.update", "")
		writeJSON(w, 200, &b)
		return
	}
	writeErr(w, r, 405, "method_not_allowed", "Use GET/PUT.")
}

func (s *Server) handleAudit(w http.ResponseWriter, r *http.Request) {
	_, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	list, _ := s.store.ListAudit(o, 200)
	if list == nil {
		list = []*models.AuditLog{}
	}
	writeJSON(w, 200, map[string]any{"data": list})
}

func (s *Server) handleOnboarding(w http.ResponseWriter, r *http.Request) {
	_, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	p, _ := s.store.GetRoutingPolicy(o)
	shadow := p != nil && (p.OptimizationMode == models.OptShadow || p.OptimizationMode == models.OptRecommend)
	keys, _ := s.store.ListAPIKeys(o)
	provs, _ := s.store.ListProviders(o)
	list, total, _ := s.store.ListRequests(o, 1, 0)
	_ = list
	writeJSON(w, 200, map[string]any{
		"endpoint":           "http://localhost:8080/v1",
		"steps":              []string{"Create organization", "Add provider", "Create gateway API key", "Copy endpoint", "Send first request"},
		"curl":               "curl http://localhost:8080/v1/chat/completions -H \"Authorization: Bearer YOUR_KEY\" -H \"Content-Type: application/json\" -d '{\"model\": \"auto\", \"messages\": [{\"role\": \"user\", \"content\": \"Hello\"}]}'",
		"shadow_mode_active": shadow,
		"progress": map[string]any{
			"has_provider": len(provs) > 0,
			"has_key":      len(keys) > 0,
			"has_request":  total > 0,
		},
	})
}

func (s *Server) handleSecuritySummary(w http.ResponseWriter, r *http.Request) {
	_, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	counts, _ := s.store.SecurityCounts(o, time.Now().Add(-24*time.Hour))
	if counts == nil {
		counts = map[string]int{}
	}
	get := func(keys ...string) int {
		t := 0
		for _, k := range keys {
			t += counts[k]
		}
		return t
	}
	writeJSON(w, 200, map[string]any{
		"pii_detections":         get("PII_DETECTED"),
		"secret_detections":      get("SECRET_DETECTED"),
		"blocked_requests":       get("REQUEST_BLOCKED"),
		"rate_limit_events":      get("RATE_LIMITED"),
		"policy_violations":      get("POLICY_VIOLATION", "BUDGET_WARNING", "BUDGET_ALERT", "BUDGET_EXCEEDED"),
		"invalid_api_key_events": get("INVALID_API_KEY"),
		"suspicious_requests":    get("SUSPICIOUS_REQUEST"),
		"counts_24h":             counts,
	})
}

func (s *Server) handleSettings(w http.ResponseWriter, r *http.Request) {
	u, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	if r.Method == http.MethodGet {
		org, _ := s.store.GetOrganization(o)
		rp, _ := s.store.GetRoutingPolicy(o)
		b, _ := s.store.GetBudget(o)
		writeJSON(w, 200, map[string]any{"organization": org, "routing_policy": rp, "budgets": b})
		return
	}
	if r.Method == http.MethodPut {
		var body struct {
			RoutingPolicy *models.RoutingPolicy `json:"routing_policy"`
			Budgets       *models.Budget        `json:"budgets"`
			Organization  *struct {
				Name string `json:"name"`
			} `json:"organization"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeErr(w, r, 400, "invalid_request", "Malformed JSON.")
			return
		}
		if body.RoutingPolicy != nil {
			body.RoutingPolicy.OrganizationID = o
			switch body.RoutingPolicy.OptimizationMode {
			case models.OptOff, models.OptShadow, models.OptRecommend, models.OptAuto:
			case "":
				cur, _ := s.store.GetRoutingPolicy(o)
				body.RoutingPolicy.OptimizationMode = cur.OptimizationMode
			default:
				writeErr(w, r, 400, "invalid_request", "optimization_mode must be OFF|SHADOW|RECOMMEND|AUTO.")
				return
			}
			if err := s.store.SaveRoutingPolicy(body.RoutingPolicy); err != nil {
				writeErr(w, r, 500, "internal", "Could not save policy.")
				return
			}
			user, _ := s.store.GetUser(u)
			s.audit(o, user.Email, "routing_policy.update", string(body.RoutingPolicy.OptimizationMode))
		}
		if body.Budgets != nil {
			body.Budgets.OrganizationID = o
			_ = s.store.SaveBudget(body.Budgets)
			user, _ := s.store.GetUser(u)
			s.audit(o, user.Email, "budget.update", "")
		}
		org, _ := s.store.GetOrganization(o)
		rp, _ := s.store.GetRoutingPolicy(o)
		b, _ := s.store.GetBudget(o)
		writeJSON(w, 200, map[string]any{"organization": org, "routing_policy": rp, "budgets": b})
		return
	}
	writeErr(w, r, 405, "method_not_allowed", "Use GET/PUT.")
}

func (s *Server) handleMembers(w http.ResponseWriter, r *http.Request) {
	u, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	if r.Method == http.MethodGet {
		members, _ := s.store.ListMembers(o)
		out := []any{}
		for _, m := range members {
			email := ""
			if usr, err := s.store.GetUser(m.UserID); err == nil {
				email = usr.Email
			}
			out = append(out, map[string]any{"id": m.ID, "user_id": m.UserID, "email": email, "role": m.Role, "organization_id": m.OrganizationID})
		}
		if out == nil {
			out = []any{}
		}
		writeJSON(w, 200, map[string]any{"data": out})
		return
	}
	if r.Method == http.MethodPost {
		var body struct {
			Email string `json:"email"`
			Role  string `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Email == "" {
			writeErr(w, r, 400, "invalid_request", "email is required.")
			return
		}
		role := body.Role
		if role == "" {
			role = "member"
		}
		target, err := s.store.GetUserByEmail(body.Email)
		if err != nil {
			writeErr(w, r, 404, "not_found", "User with that email does not exist. They must sign up first.")
			return
		}
		_ = s.store.AddMembership(o, target.ID, role)
		user, _ := s.store.GetUser(u)
		s.audit(o, user.Email, "member.add", body.Email)
		writeJSON(w, 201, map[string]any{"ok": true})
		return
	}
	writeErr(w, r, 405, "method_not_allowed", "Use GET/POST.")
}

func (s *Server) handleAlerts(w http.ResponseWriter, r *http.Request) {
	u, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	if r.Method == http.MethodGet {
		list, _ := s.store.ListAlerts(o)
		if list == nil {
			list = []*models.Alert{}
		}
		writeJSON(w, 200, map[string]any{"data": list})
		return
	}
	if r.Method == http.MethodPost {
		var body struct {
			Type      string  `json:"type"`
			Threshold float64 `json:"threshold"`
			Channel   string  `json:"channel"`
			Message   string  `json:"message"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Type == "" {
			writeErr(w, r, 400, "invalid_request", "type is required.")
			return
		}
		ch := body.Channel
		if ch == "" {
			ch = "dashboard"
		}
		a := &models.Alert{OrganizationID: o, Type: body.Type, Threshold: body.Threshold, Channel: ch, Enabled: true, Message: body.Message}
		_ = s.store.CreateAlert(a)
		user, _ := s.store.GetUser(u)
		s.audit(o, user.Email, "alert.create", body.Type)
		writeJSON(w, 201, a)
		return
	}
	writeErr(w, r, 405, "method_not_allowed", "Use GET/POST.")
}

func (s *Server) handleAlertByID(w http.ResponseWriter, r *http.Request) {
	_, o, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/alerts/")
	if id == "" {
		writeErr(w, r, 404, "not_found", "Alert not found.")
		return
	}
	if r.Method != http.MethodDelete {
		writeErr(w, r, 405, "method_not_allowed", "Use DELETE.")
		return
	}
	_ = s.store.DeleteAlert(o, id)
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) handleModelPrices(w http.ResponseWriter, r *http.Request) {
	_, _, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	list, _ := s.store.ListModelPrices()
	if list == nil {
		list = []*models.ModelPrice{}
	}
	models_, _ := s.store.ListModels()
	writeJSON(w, 200, map[string]any{"data": list, "registry": models_})
}
