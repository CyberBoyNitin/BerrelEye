package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func ctx() context.Context { return context.Background() }

func (p *Postgres) CreateOrganization(name, slug string) (*models.Organization, error) {
	o := &models.Organization{ID: uuid.NewString(), Name: name, Slug: slug, CreatedAt: time.Now().UTC()}
	_, err := p.pool.Exec(ctx(), `INSERT INTO organizations(id,name,slug) VALUES($1,$2,$3)`, o.ID, name, slug)
	return o, err
}

func (p *Postgres) GetOrganization(id string) (*models.Organization, error) {
	o := &models.Organization{}
	err := p.pool.QueryRow(ctx(), `SELECT id,name,slug,created_at FROM organizations WHERE id=$1`, id).Scan(&o.ID, &o.Name, &o.Slug, &o.CreatedAt)
	return o, err
}

func (p *Postgres) ListOrganizationsForUser(userID string) ([]*models.Organization, error) {
	rows, err := p.pool.Query(ctx(), `SELECT o.id,o.name,o.slug,o.created_at FROM organizations o JOIN memberships m ON m.organization_id=o.id WHERE m.user_id=$1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.Organization
	for rows.Next() {
		o := &models.Organization{}
		if err := rows.Scan(&o.ID, &o.Name, &o.Slug, &o.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

func (p *Postgres) CreateUser(email, passwordHash string) (*models.User, error) {
	u := &models.User{ID: uuid.NewString(), Email: email, PasswordHash: passwordHash, CreatedAt: time.Now().UTC()}
	_, err := p.pool.Exec(ctx(), `INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)`, u.ID, email, passwordHash)
	return u, err
}

func (p *Postgres) GetUserByEmail(email string) (*models.User, error) {
	u := &models.User{}
	err := p.pool.QueryRow(ctx(), `SELECT id,email,password_hash,created_at FROM users WHERE email=$1`, email).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt)
	return u, err
}

func (p *Postgres) GetUser(id string) (*models.User, error) {
	u := &models.User{}
	err := p.pool.QueryRow(ctx(), `SELECT id,email,password_hash,created_at FROM users WHERE id=$1`, id).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt)
	return u, err
}

func (p *Postgres) AddMembership(orgID, userID, role string) error {
	_, err := p.pool.Exec(ctx(), `INSERT INTO memberships(id,organization_id,user_id,role) VALUES($1,$2,$3,$4) ON CONFLICT (organization_id,user_id) DO UPDATE SET role=$4`, uuid.NewString(), orgID, userID, role)
	return err
}

func (p *Postgres) GetMembership(orgID, userID string) (*models.Membership, error) {
	ms := &models.Membership{}
	err := p.pool.QueryRow(ctx(), `SELECT id,organization_id,user_id,role FROM memberships WHERE organization_id=$1 AND user_id=$2`, orgID, userID).Scan(&ms.ID, &ms.OrganizationID, &ms.UserID, &ms.Role)
	return ms, err
}

func (p *Postgres) ListMembers(orgID string) ([]*models.Membership, error) {
	rows, err := p.pool.Query(ctx(), `SELECT id,organization_id,user_id,role FROM memberships WHERE organization_id=$1`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.Membership
	for rows.Next() {
		ms := &models.Membership{}
		if err := rows.Scan(&ms.ID, &ms.OrganizationID, &ms.UserID, &ms.Role); err != nil {
			return nil, err
		}
		out = append(out, ms)
	}
	return out, rows.Err()
}

func (p *Postgres) CreateSession(userID, orgID, tokenHash string, expires time.Time) error {
	_, err := p.pool.Exec(ctx(), `INSERT INTO sessions(id,user_id,organization_id,token_hash,expires_at) VALUES($1,$2,$3,$4,$5)`, uuid.NewString(), userID, orgID, tokenHash, expires)
	return err
}

func (p *Postgres) GetSession(tokenHash string) (string, string, time.Time, error) {
	var u, o string
	var e time.Time
	err := p.pool.QueryRow(ctx(), `SELECT user_id,organization_id,expires_at FROM sessions WHERE token_hash=$1`, tokenHash).Scan(&u, &o, &e)
	if err != nil {
		return "", "", time.Time{}, err
	}
	if time.Now().After(e) {
		return "", "", time.Time{}, fmt.Errorf("expired")
	}
	return u, o, e, nil
}

func (p *Postgres) DeleteSession(tokenHash string) error {
	_, err := p.pool.Exec(ctx(), `DELETE FROM sessions WHERE token_hash=$1`, tokenHash)
	return err
}

func (p *Postgres) CreateAPIKey(k *models.APIKey) error {
	k.ID = uuid.NewString()
	k.CreatedAt = time.Now().UTC()
	_, err := p.pool.Exec(ctx(), `INSERT INTO api_keys(id,organization_id,name,environment,key_prefix,key_hash,permissions) VALUES($1,$2,$3,$4,$5,$6,$7)`,
		k.ID, k.OrganizationID, k.Name, k.Environment, k.KeyPrefix, k.KeyHash, k.Permissions)
	return err
}

func (p *Postgres) GetAPIKeyByHash(hash string) (*models.APIKey, error) {
	k := &models.APIKey{}
	err := p.pool.QueryRow(ctx(), `SELECT id,organization_id,name,environment,key_prefix,key_hash,permissions,created_at,last_used_at,revoked_at FROM api_keys WHERE key_hash=$1`, hash).
		Scan(&k.ID, &k.OrganizationID, &k.Name, &k.Environment, &k.KeyPrefix, &k.KeyHash, &k.Permissions, &k.CreatedAt, &k.LastUsedAt, &k.RevokedAt)
	return k, err
}

func (p *Postgres) ListAPIKeys(orgID string) ([]*models.APIKey, error) {
	rows, err := p.pool.Query(ctx(), `SELECT id,organization_id,name,environment,key_prefix,key_hash,permissions,created_at,last_used_at,revoked_at FROM api_keys WHERE organization_id=$1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.APIKey
	for rows.Next() {
		k := &models.APIKey{}
		if err := rows.Scan(&k.ID, &k.OrganizationID, &k.Name, &k.Environment, &k.KeyPrefix, &k.KeyHash, &k.Permissions, &k.CreatedAt, &k.LastUsedAt, &k.RevokedAt); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

func (p *Postgres) TouchAPIKey(id string) error {
	_, err := p.pool.Exec(ctx(), `UPDATE api_keys SET last_used_at=NOW() WHERE id=$1`, id)
	return err
}

func (p *Postgres) RevokeAPIKey(orgID, id string) error {
	_, err := p.pool.Exec(ctx(), `UPDATE api_keys SET revoked_at=NOW() WHERE id=$1 AND organization_id=$2`, id, orgID)
	return err
}

func (p *Postgres) UpsertProvider(cfg *models.ProviderConfig) error {
	if cfg.ID == "" {
		cfg.ID = uuid.NewString()
	}
	_, err := p.pool.Exec(ctx(), `INSERT INTO provider_configs(id,organization_id,provider,name,base_url,api_key_cipher,api_key_hint,dev_only,enabled)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
		ON CONFLICT (id) DO UPDATE SET name=$4,base_url=$5,api_key_cipher=$6,api_key_hint=$7,dev_only=$8,enabled=$9`,
		cfg.ID, cfg.OrganizationID, cfg.Provider, cfg.Name, cfg.BaseURL, cfg.APIKeyCipher, cfg.APIKeyHint, cfg.DevOnly, cfg.Enabled)
	return err
}

func (p *Postgres) ListProviders(orgID string) ([]*models.ProviderConfig, error) {
	rows, err := p.pool.Query(ctx(), `SELECT id,organization_id,provider,name,base_url,api_key_cipher,api_key_hint,dev_only,enabled FROM provider_configs WHERE organization_id IN ($1,'global')`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.ProviderConfig
	for rows.Next() {
		c := &models.ProviderConfig{}
		if err := rows.Scan(&c.ID, &c.OrganizationID, &c.Provider, &c.Name, &c.BaseURL, &c.APIKeyCipher, &c.APIKeyHint, &c.DevOnly, &c.Enabled); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (p *Postgres) GetProvider(orgID, id string) (*models.ProviderConfig, error) {
	c := &models.ProviderConfig{}
	err := p.pool.QueryRow(ctx(), `SELECT id,organization_id,provider,name,base_url,api_key_cipher,api_key_hint,dev_only,enabled FROM provider_configs WHERE id=$1 AND organization_id IN ($2,'global')`, id, orgID).
		Scan(&c.ID, &c.OrganizationID, &c.Provider, &c.Name, &c.BaseURL, &c.APIKeyCipher, &c.APIKeyHint, &c.DevOnly, &c.Enabled)
	return c, err
}

func (p *Postgres) DeleteProvider(orgID, id string) error {
	_, err := p.pool.Exec(ctx(), `DELETE FROM provider_configs WHERE id=$1 AND organization_id=$2`, id, orgID)
	return err
}

func (p *Postgres) ListModels() ([]*models.Model, error) {
	rows, err := p.pool.Query(ctx(), `SELECT provider,model_name,input_price,output_price,context_window,capabilities,supports_streaming,supports_tools,supports_json,quality_tier,latency_tier,enabled FROM models WHERE enabled=true ORDER BY model_name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.Model
	for rows.Next() {
		md := &models.Model{}
		var caps []byte
		if err := rows.Scan(&md.Provider, &md.ModelName, &md.InputPrice, &md.OutputPrice, &md.ContextWindow, &caps, &md.SupportsStream, &md.SupportsTools, &md.SupportsJSON, &md.QualityTier, &md.LatencyTier, &md.Enabled); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(caps, &md.Capabilities)
		out = append(out, md)
	}
	return out, rows.Err()
}

func (p *Postgres) UpsertModel(md *models.Model) error {
	caps, _ := json.Marshal(md.Capabilities)
	_, err := p.pool.Exec(ctx(), `INSERT INTO models(provider,model_name,input_price,output_price,context_window,capabilities,supports_streaming,supports_tools,supports_json,quality_tier,latency_tier,enabled)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		ON CONFLICT (model_name) DO UPDATE SET provider=$1,input_price=$3,output_price=$4,context_window=$5,capabilities=$6,supports_streaming=$7,supports_tools=$8,supports_json=$9,quality_tier=$10,latency_tier=$11,enabled=$12`,
		md.Provider, md.ModelName, md.InputPrice, md.OutputPrice, md.ContextWindow, caps, md.SupportsStream, md.SupportsTools, md.SupportsJSON, md.QualityTier, md.LatencyTier, md.Enabled)
	return err
}

func (p *Postgres) GetModel(name string) (*models.Model, error) {
	md := &models.Model{}
	var caps []byte
	err := p.pool.QueryRow(ctx(), `SELECT provider,model_name,input_price,output_price,context_window,capabilities,supports_streaming,supports_tools,supports_json,quality_tier,latency_tier,enabled FROM models WHERE model_name=$1`, name).
		Scan(&md.Provider, &md.ModelName, &md.InputPrice, &md.OutputPrice, &md.ContextWindow, &caps, &md.SupportsStream, &md.SupportsTools, &md.SupportsJSON, &md.QualityTier, &md.LatencyTier, &md.Enabled)
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(caps, &md.Capabilities)
	return md, nil
}

func (p *Postgres) GetRoutingPolicy(orgID string) (*models.RoutingPolicy, error) {
	rp := defaultPolicy(orgID)
	err := p.pool.QueryRow(ctx(), `SELECT organization_id,optimization_mode,default_model,quality_weight,cost_weight,latency_weight,semantic_cache_enabled,semantic_threshold,cache_ttl_seconds,budget_behavior,COALESCE(rate_limit_org_per_min,600),COALESCE(rate_limit_key_per_min,300),COALESCE(rate_limit_ip_per_min,300) FROM routing_policies WHERE organization_id=$1`, orgID).
		Scan(&rp.OrganizationID, &rp.OptimizationMode, &rp.DefaultModel, &rp.QualityWeight, &rp.CostWeight, &rp.LatencyWeight, &rp.SemanticCache, &rp.SemanticThreshold, &rp.CacheTTLSeconds, &rp.BudgetBehavior, &rp.RateLimitOrgPerMin, &rp.RateLimitKeyPerMin, &rp.RateLimitIPPerMin)
	if err == pgx.ErrNoRows {
		return defaultPolicy(orgID), nil
	}
	return rp, err
}

func (p *Postgres) SaveRoutingPolicy(rp *models.RoutingPolicy) error {
	if rp.RateLimitOrgPerMin <= 0 {
		rp.RateLimitOrgPerMin = 600
	}
	if rp.RateLimitKeyPerMin <= 0 {
		rp.RateLimitKeyPerMin = 300
	}
	if rp.RateLimitIPPerMin <= 0 {
		rp.RateLimitIPPerMin = 300
	}
	_, err := p.pool.Exec(ctx(), `INSERT INTO routing_policies(organization_id,optimization_mode,default_model,quality_weight,cost_weight,latency_weight,semantic_cache_enabled,semantic_threshold,cache_ttl_seconds,budget_behavior,rate_limit_org_per_min,rate_limit_key_per_min,rate_limit_ip_per_min)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		ON CONFLICT (organization_id) DO UPDATE SET optimization_mode=$2,default_model=$3,quality_weight=$4,cost_weight=$5,latency_weight=$6,semantic_cache_enabled=$7,semantic_threshold=$8,cache_ttl_seconds=$9,budget_behavior=$10,rate_limit_org_per_min=$11,rate_limit_key_per_min=$12,rate_limit_ip_per_min=$13`,
		rp.OrganizationID, rp.OptimizationMode, rp.DefaultModel, rp.QualityWeight, rp.CostWeight, rp.LatencyWeight, rp.SemanticCache, rp.SemanticThreshold, rp.CacheTTLSeconds, rp.BudgetBehavior, rp.RateLimitOrgPerMin, rp.RateLimitKeyPerMin, rp.RateLimitIPPerMin)
	return err
}

func (p *Postgres) InsertRequest(r *models.RequestRecord) error {
	if r.ID == "" {
		r.ID = uuid.NewString()
	}
	if r.CreatedAt.IsZero() {
		r.CreatedAt = time.Now().UTC()
	}
	reason, _ := json.Marshal(r.RoutingReason)
	_, err := p.pool.Exec(ctx(), `INSERT INTO requests(id,organization_id,api_key_id,request_id,requested_model,selected_model,provider,status,error,input_tokens,output_tokens,total_tokens,estimated_cost,latency_ms,ttft_ms,cache_hit,cache_type,routing_mode,routing_reason)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
		r.ID, r.OrganizationID, nullIfEmpty(r.APIKeyID), r.RequestID, r.RequestedModel, r.SelectedModel, r.Provider, r.Status, nullIfEmpty(r.Error),
		r.InputTokens, r.OutputTokens, r.TotalTokens, r.EstimatedCost, r.LatencyMs, r.TTFTMs, r.CacheHit, nullIfEmpty(r.CacheType), r.RoutingMode, reason)
	return err
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func (p *Postgres) ListRequests(orgID string, limit, offset int) ([]*models.RequestRecord, int, error) {
	var total int
	if err := p.pool.QueryRow(ctx(), `SELECT COUNT(*) FROM requests WHERE organization_id=$1`, orgID).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := p.pool.Query(ctx(), `SELECT id,organization_id,COALESCE(api_key_id,''),request_id,requested_model,selected_model,provider,status,COALESCE(error,''),input_tokens,output_tokens,total_tokens,estimated_cost,latency_ms,ttft_ms,cache_hit,COALESCE(cache_type,''),routing_mode,routing_reason,created_at FROM requests WHERE organization_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, orgID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []*models.RequestRecord
	for rows.Next() {
		r := &models.RequestRecord{}
		var reason []byte
		if err := rows.Scan(&r.ID, &r.OrganizationID, &r.APIKeyID, &r.RequestID, &r.RequestedModel, &r.SelectedModel, &r.Provider, &r.Status, &r.Error, &r.InputTokens, &r.OutputTokens, &r.TotalTokens, &r.EstimatedCost, &r.LatencyMs, &r.TTFTMs, &r.CacheHit, &r.CacheType, &r.RoutingMode, &reason, &r.CreatedAt); err != nil {
			return nil, 0, err
		}
		_ = json.Unmarshal(reason, &r.RoutingReason)
		out = append(out, r)
	}
	return out, total, rows.Err()
}

func (p *Postgres) GetRequest(orgID, id string) (*models.RequestRecord, error) {
	r := &models.RequestRecord{}
	var reason []byte
	err := p.pool.QueryRow(ctx(), `SELECT id,organization_id,COALESCE(api_key_id,''),request_id,requested_model,selected_model,provider,status,COALESCE(error,''),input_tokens,output_tokens,total_tokens,estimated_cost,latency_ms,ttft_ms,cache_hit,COALESCE(cache_type,''),routing_mode,routing_reason,created_at FROM requests WHERE organization_id=$1 AND (id=$2 OR request_id=$2)`, orgID, id).
		Scan(&r.ID, &r.OrganizationID, &r.APIKeyID, &r.RequestID, &r.RequestedModel, &r.SelectedModel, &r.Provider, &r.Status, &r.Error, &r.InputTokens, &r.OutputTokens, &r.TotalTokens, &r.EstimatedCost, &r.LatencyMs, &r.TTFTMs, &r.CacheHit, &r.CacheType, &r.RoutingMode, &reason, &r.CreatedAt)
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(reason, &r.RoutingReason)
	return r, nil
}

func (p *Postgres) InsertRoutingDecision(d *models.RoutingDecision) error {
	if d.ID == "" {
		d.ID = uuid.NewString()
	}
	reason, _ := json.Marshal(d.RoutingReason)
	_, err := p.pool.Exec(ctx(), `INSERT INTO routing_decisions(id,organization_id,request_id,requested_model,recommended_model,selected_model,actual_cost,estimated_optimized_cost,estimated_savings,routing_reason,category)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		d.ID, d.OrganizationID, d.RequestID, d.RequestedModel, d.RecommendedModel, d.SelectedModel, d.ActualCost, d.EstimatedOptimized, d.EstimatedSavings, reason, d.Category)
	return err
}

func (p *Postgres) GetRoutingDecisionByRequest(orgID, requestID string) (*models.RoutingDecision, error) {
	d := &models.RoutingDecision{}
	var reason []byte
	err := p.pool.QueryRow(ctx(), `SELECT id,organization_id,request_id,requested_model,recommended_model,selected_model,actual_cost,estimated_optimized_cost,estimated_savings,routing_reason,category,created_at FROM routing_decisions WHERE organization_id=$1 AND request_id=$2`, orgID, requestID).
		Scan(&d.ID, &d.OrganizationID, &d.RequestID, &d.RequestedModel, &d.RecommendedModel, &d.SelectedModel, &d.ActualCost, &d.EstimatedOptimized, &d.EstimatedSavings, &reason, &d.Category, &d.CreatedAt)
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(reason, &d.RoutingReason)
	return d, nil
}

func (p *Postgres) InsertProviderAttempt(a *models.ProviderAttempt) error {
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	_, err := p.pool.Exec(ctx(), `INSERT INTO provider_attempts(id,request_id,provider,model,status,status_code,latency_ms,error) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
		a.ID, a.RequestID, a.Provider, a.Model, a.Status, a.StatusCode, a.LatencyMs, nullIfEmpty(a.Error))
	return err
}

func (p *Postgres) ListProviderAttempts(requestID string) ([]*models.ProviderAttempt, error) {
	rows, err := p.pool.Query(ctx(), `SELECT id,request_id,provider,model,status,status_code,latency_ms,COALESCE(error,'') FROM provider_attempts WHERE request_id=$1 ORDER BY created_at`, requestID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.ProviderAttempt
	for rows.Next() {
		a := &models.ProviderAttempt{}
		if err := rows.Scan(&a.ID, &a.RequestID, &a.Provider, &a.Model, &a.Status, &a.StatusCode, &a.LatencyMs, &a.Error); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (p *Postgres) InsertSecurityEvent(e *models.SecurityEvent) error {
	if e.ID == "" {
		e.ID = uuid.NewString()
	}
	_, err := p.pool.Exec(ctx(), `INSERT INTO security_events(id,organization_id,request_id,type,detail) VALUES($1,$2,$3,$4,$5)`,
		e.ID, e.OrganizationID, nullIfEmpty(e.RequestID), e.Type, e.Detail)
	return err
}

func (p *Postgres) ListSecurityEvents(orgID string, limit int) ([]*models.SecurityEvent, error) {
	rows, err := p.pool.Query(ctx(), `SELECT id,organization_id,COALESCE(request_id,''),type,detail,created_at FROM security_events WHERE organization_id=$1 ORDER BY created_at DESC LIMIT $2`, orgID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.SecurityEvent
	for rows.Next() {
		e := &models.SecurityEvent{}
		if err := rows.Scan(&e.ID, &e.OrganizationID, &e.RequestID, &e.Type, &e.Detail, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (p *Postgres) SecurityCounts(orgID string, since time.Time) (map[string]int, error) {
	rows, err := p.pool.Query(ctx(), `SELECT type,COUNT(*) FROM security_events WHERE organization_id=$1 AND created_at>$2 GROUP BY type`, orgID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	counts := map[string]int{}
	for rows.Next() {
		var t string
		var c int
		if err := rows.Scan(&t, &c); err != nil {
			return nil, err
		}
		counts[t] = c
	}
	return counts, rows.Err()
}

func (p *Postgres) GetBudget(orgID string) (*models.Budget, error) {
	b := &models.Budget{OrganizationID: orgID}
	err := p.pool.QueryRow(ctx(), `SELECT monthly_budget,daily_budget,per_request_limit FROM budgets WHERE organization_id=$1`, orgID).Scan(&b.MonthlyBudget, &b.DailyBudget, &b.PerRequestLimit)
	if err == pgx.ErrNoRows {
		return b, nil
	}
	return b, err
}

func (p *Postgres) SaveBudget(b *models.Budget) error {
	_, err := p.pool.Exec(ctx(), `INSERT INTO budgets(organization_id,monthly_budget,daily_budget,per_request_limit) VALUES($1,$2,$3,$4)
		ON CONFLICT (organization_id) DO UPDATE SET monthly_budget=$2,daily_budget=$3,per_request_limit=$4`,
		b.OrganizationID, b.MonthlyBudget, b.DailyBudget, b.PerRequestLimit)
	return err
}

func (p *Postgres) SpendSince(orgID string, since time.Time) (float64, error) {
	var total *float64
	err := p.pool.QueryRow(ctx(), `SELECT SUM(estimated_cost) FROM requests WHERE organization_id=$1 AND created_at>$2 AND status='success'`, orgID, since).Scan(&total)
	if err != nil || total == nil {
		return 0, err
	}
	return *total, nil
}

func (p *Postgres) InsertAudit(a *models.AuditLog) error {
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	_, err := p.pool.Exec(ctx(), `INSERT INTO audit_logs(id,organization_id,actor,action,metadata) VALUES($1,$2,$3,$4,$5)`,
		a.ID, a.OrganizationID, a.Actor, a.Action, nullIfEmpty(a.Metadata))
	return err
}

func (p *Postgres) ListAudit(orgID string, limit int) ([]*models.AuditLog, error) {
	rows, err := p.pool.Query(ctx(), `SELECT id,organization_id,actor,action,COALESCE(metadata,''),created_at FROM audit_logs WHERE organization_id=$1 ORDER BY created_at DESC LIMIT $2`, orgID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.AuditLog
	for rows.Next() {
		a := &models.AuditLog{}
		if err := rows.Scan(&a.ID, &a.OrganizationID, &a.Actor, &a.Action, &a.Metadata, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (p *Postgres) UpsertCacheEntry(orgID, cacheKey, modelClass, sysHash, paramsHash, response string, embedding []float32, expires time.Time) error {
	vec := embeddingToVector(embedding)
	_, err := p.pool.Exec(ctx(), `INSERT INTO cache_entries(organization_id,cache_key,model_class,system_hash,params_hash,response,embedding,expires_at)
		VALUES($1,$2,$3,$4,$5,$6,$7::vector,$8)
		ON CONFLICT (organization_id,cache_key) DO UPDATE SET response=$6,embedding=$7::vector,expires_at=$8,hit_count=cache_entries.hit_count`,
		orgID, cacheKey, modelClass, sysHash, paramsHash, response, vec, expires)
	return err
}

func (p *Postgres) GetCacheEntry(orgID, cacheKey string) (string, int, error) {
	var resp string
	var hits int
	err := p.pool.QueryRow(ctx(), `UPDATE cache_entries SET hit_count=hit_count+1 WHERE organization_id=$1 AND cache_key=$2 AND expires_at>NOW() RETURNING response,hit_count`, orgID, cacheKey).Scan(&resp, &hits)
	return resp, hits, err
}

func (p *Postgres) SemanticSearch(orgID, modelClass string, embedding []float32, threshold float64, limit int) (string, string, float64, error) {
	vec := embeddingToVector(embedding)
	var resp, key string
	var score float64
	// cosine distance operator <=> ; score = 1 - distance
	err := p.pool.QueryRow(ctx(), `SELECT response,cache_key,1-(embedding <=> $3::vector) AS score FROM cache_entries
		WHERE organization_id=$1 AND model_class=$2 AND expires_at>NOW() AND 1-(embedding <=> $3::vector) >= $4
		ORDER BY embedding <=> $3::vector LIMIT 1`, orgID, modelClass, vec, threshold).Scan(&resp, &key, &score)
	return resp, key, score, err
}

func (p *Postgres) CacheStats(orgID string) (int64, int64, error) {
	var reqs, hits *int64
	err := p.pool.QueryRow(ctx(), `SELECT SUM(CASE WHEN cache_hit THEN 0 ELSE 1 END)+SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END), SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) FROM requests WHERE organization_id=$1`, orgID).Scan(&reqs, &hits)
	if err != nil {
		return 0, 0, err
	}
	var r, h int64
	if reqs != nil {
		r = *reqs
	}
	if hits != nil {
		h = *hits
	}
	return r, h, nil
}

func (p *Postgres) RecordCacheLookup(orgID string, hit bool) error { return nil }

func (p *Postgres) ListAlerts(orgID string) ([]*models.Alert, error) {
	rows, err := p.pool.Query(ctx(), `SELECT id,organization_id,type,threshold,channel,enabled,COALESCE(message,''),created_at FROM alerts WHERE organization_id=$1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.Alert
	for rows.Next() {
		a := &models.Alert{}
		if err := rows.Scan(&a.ID, &a.OrganizationID, &a.Type, &a.Threshold, &a.Channel, &a.Enabled, &a.Message, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (p *Postgres) CreateAlert(a *models.Alert) error {
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	_, err := p.pool.Exec(ctx(), `INSERT INTO alerts(id,organization_id,type,threshold,channel,enabled,message) VALUES($1,$2,$3,$4,$5,$6,$7)`,
		a.ID, a.OrganizationID, a.Type, a.Threshold, a.Channel, a.Enabled, nullIfEmpty(a.Message))
	return err
}

func (p *Postgres) DeleteAlert(orgID, id string) error {
	_, err := p.pool.Exec(ctx(), `DELETE FROM alerts WHERE organization_id=$1 AND id=$2`, orgID, id)
	return err
}

func (p *Postgres) InsertRequestMessages(orgID, requestID string, msgs []models.ChatMessage) error {
	for _, mm := range msgs {
		h := fmt.Sprintf("%x", len(mm.Role)+len(mm.Content))
		_, err := p.pool.Exec(ctx(), `INSERT INTO request_messages(id,organization_id,request_id,role,content_hash) VALUES($1,$2,$3,$4,$5)`,
			uuid.NewString(), orgID, requestID, mm.Role, h)
		if err != nil {
			return err
		}
	}
	return nil
}

func (p *Postgres) InsertRequestUsage(u *models.RequestUsage) error {
	if u.ID == "" {
		u.ID = uuid.NewString()
	}
	_, err := p.pool.Exec(ctx(), `INSERT INTO request_usage(id,organization_id,request_id,input_tokens,output_tokens,total_tokens,estimated,latency_ms,ttft_ms) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		u.ID, u.OrganizationID, u.RequestID, u.InputTokens, u.OutputTokens, u.TotalTokens, u.Estimated, u.LatencyMs, u.TTFTMs)
	return err
}

func (p *Postgres) InsertRequestCost(c *models.RequestCost) error {
	if c.ID == "" {
		c.ID = uuid.NewString()
	}
	_, err := p.pool.Exec(ctx(), `INSERT INTO request_costs(id,organization_id,request_id,input_cost,output_cost,total_cost) VALUES($1,$2,$3,$4,$5,$6)`,
		c.ID, c.OrganizationID, c.RequestID, c.InputCost, c.OutputCost, c.TotalCost)
	return err
}

func (p *Postgres) UpsertModelPrice(mp *models.ModelPrice) error {
	if mp.ID == "" {
		mp.ID = uuid.NewString()
	}
	_, err := p.pool.Exec(ctx(), `INSERT INTO model_prices(id,model_name,input_price,output_price) VALUES($1,$2,$3,$4)`, mp.ID, mp.ModelName, mp.InputPrice, mp.OutputPrice)
	return err
}

func (p *Postgres) ListModelPrices() ([]*models.ModelPrice, error) {
	rows, err := p.pool.Query(ctx(), `SELECT id,model_name,input_price,output_price,effective_at FROM model_prices ORDER BY effective_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.ModelPrice
	for rows.Next() {
		mp := &models.ModelPrice{}
		if err := rows.Scan(&mp.ID, &mp.ModelName, &mp.InputPrice, &mp.OutputPrice, &mp.EffectiveAt); err != nil {
			return nil, err
		}
		out = append(out, mp)
	}
	return out, rows.Err()
}

func embeddingToVector(e []float32) string {
	if len(e) == 0 {
		return "[]"
	}
	b, _ := json.Marshal(e)
	return string(b)
}
