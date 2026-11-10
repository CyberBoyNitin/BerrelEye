package store

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/models"
	"github.com/google/uuid"
)

// Memory is a thread-safe in-process Store. Used when STORE=memory
// (no DATABASE_URL) and in unit tests.
type Memory struct {
	mu          sync.RWMutex
	orgs        map[string]*models.Organization
	orgsBySlug  map[string]*models.Organization
	users       map[string]*models.User
	usersByMail map[string]*models.User
	memberships map[string]*models.Membership // orgID:userID
	sessions    map[string]session
	apiKeys     map[string]*models.APIKey
	apiKeyByH   map[string]*models.APIKey
	providers   map[string]*models.ProviderConfig
	models      map[string]*models.Model
	policies    map[string]*models.RoutingPolicy
	requests    map[string]*models.RequestRecord
	reqOrder    []string
	decisions   map[string]*models.RoutingDecision // by requestID
	attempts    map[string][]*models.ProviderAttempt
	secEvents   []*models.SecurityEvent
	budgets     map[string]*models.Budget
	audits      []*models.AuditLog
	cache       map[string]cacheEntry
	cacheHits   map[string]int64
	cacheReqs   map[string]int64
	alerts      map[string]*models.Alert
	reqMsgs     map[string][]*models.RequestMessage
	reqUsage    map[string]*models.RequestUsage
	reqCosts    map[string]*models.RequestCost
	modelPrices map[string]*models.ModelPrice
}

type session struct {
	userID  string
	orgID   string
	expires time.Time
}

type cacheEntry struct {
	orgID     string
	modelCls  string
	response  string
	embedding []float32
	expires   time.Time
	hits      int
}

func NewMemory() *Memory {
	return &Memory{
		orgs: map[string]*models.Organization{}, orgsBySlug: map[string]*models.Organization{},
		users: map[string]*models.User{}, usersByMail: map[string]*models.User{},
		memberships: map[string]*models.Membership{}, sessions: map[string]session{},
		apiKeys: map[string]*models.APIKey{}, apiKeyByH: map[string]*models.APIKey{},
		providers: map[string]*models.ProviderConfig{}, models: map[string]*models.Model{},
		policies: map[string]*models.RoutingPolicy{}, requests: map[string]*models.RequestRecord{},
		decisions: map[string]*models.RoutingDecision{}, attempts: map[string][]*models.ProviderAttempt{},
		budgets: map[string]*models.Budget{}, cache: map[string]cacheEntry{},
		cacheHits: map[string]int64{}, cacheReqs: map[string]int64{},
		alerts: map[string]*models.Alert{}, reqMsgs: map[string][]*models.RequestMessage{},
		reqUsage: map[string]*models.RequestUsage{}, reqCosts: map[string]*models.RequestCost{},
		modelPrices: map[string]*models.ModelPrice{},
	}
}

func (m *Memory) CreateOrganization(name, slug string) (*models.Organization, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.orgsBySlug[slug]; ok {
		return nil, fmt.Errorf("slug taken")
	}
	o := &models.Organization{ID: uuid.NewString(), Name: name, Slug: slug, CreatedAt: time.Now().UTC()}
	m.orgs[o.ID] = o
	m.orgsBySlug[slug] = o
	return o, nil
}

func (m *Memory) GetOrganization(id string) (*models.Organization, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	o, ok := m.orgs[id]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	return o, nil
}

func (m *Memory) ListOrganizationsForUser(userID string) ([]*models.Organization, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []*models.Organization
	for k := range m.memberships {
		parts := strings.SplitN(k, ":", 2)
		if len(parts) != 2 {
			continue
		}
		orgID, uid := parts[0], parts[1]
		if uid == userID {
			if o, ok := m.orgs[orgID]; ok {
				out = append(out, o)
			}
		}
	}
	return out, nil
}

func (m *Memory) CreateUser(email, passwordHash string) (*models.User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.usersByMail[email]; ok {
		return nil, fmt.Errorf("email taken")
	}
	u := &models.User{ID: uuid.NewString(), Email: email, PasswordHash: passwordHash, CreatedAt: time.Now().UTC()}
	m.users[u.ID] = u
	m.usersByMail[email] = u
	return u, nil
}

func (m *Memory) GetUserByEmail(email string) (*models.User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	u, ok := m.usersByMail[email]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	return u, nil
}

func (m *Memory) GetUser(id string) (*models.User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	u, ok := m.users[id]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	return u, nil
}

func (m *Memory) AddMembership(orgID, userID, role string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	id := uuid.NewString()
	m.memberships[orgID+":"+userID] = &models.Membership{ID: id, OrganizationID: orgID, UserID: userID, Role: role}
	return nil
}

func (m *Memory) GetMembership(orgID, userID string) (*models.Membership, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	ms, ok := m.memberships[orgID+":"+userID]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	return ms, nil
}

func (m *Memory) ListMembers(orgID string) ([]*models.Membership, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []*models.Membership
	for _, ms := range m.memberships {
		if ms.OrganizationID == orgID {
			out = append(out, ms)
		}
	}
	return out, nil
}

func (m *Memory) CreateSession(userID, orgID, tokenHash string, expires time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sessions[tokenHash] = session{userID: userID, orgID: orgID, expires: expires}
	return nil
}

func (m *Memory) GetSession(tokenHash string) (string, string, time.Time, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.sessions[tokenHash]
	if !ok {
		return "", "", time.Time{}, fmt.Errorf("not found")
	}
	if time.Now().After(s.expires) {
		return "", "", time.Time{}, fmt.Errorf("expired")
	}
	return s.userID, s.orgID, s.expires, nil
}

func (m *Memory) DeleteSession(tokenHash string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.sessions, tokenHash)
	return nil
}

func (m *Memory) CreateAPIKey(k *models.APIKey) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	k.ID = uuid.NewString()
	k.CreatedAt = time.Now().UTC()
	m.apiKeys[k.ID] = k
	m.apiKeyByH[k.KeyHash] = k
	return nil
}

func (m *Memory) GetAPIKeyByHash(hash string) (*models.APIKey, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	k, ok := m.apiKeyByH[hash]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	return k, nil
}

func (m *Memory) ListAPIKeys(orgID string) ([]*models.APIKey, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []*models.APIKey
	for _, k := range m.apiKeys {
		if k.OrganizationID == orgID {
			out = append(out, k)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

func (m *Memory) TouchAPIKey(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if k, ok := m.apiKeys[id]; ok {
		now := time.Now().UTC()
		k.LastUsedAt = &now
	}
	return nil
}

func (m *Memory) RevokeAPIKey(orgID, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	k, ok := m.apiKeys[id]
	if !ok || k.OrganizationID != orgID {
		return fmt.Errorf("not found")
	}
	now := time.Now().UTC()
	k.RevokedAt = &now
	return nil
}

func (m *Memory) UpsertProvider(p *models.ProviderConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	m.providers[p.OrganizationID+":"+p.ID] = p
	// also index by provider name for lookup
	m.providers[p.OrganizationID+":name:"+p.Provider] = p
	return nil
}

func (m *Memory) ListProviders(orgID string) ([]*models.ProviderConfig, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	seen := map[string]bool{}
	var out []*models.ProviderConfig
	for key, p := range m.providers {
		if len(key) >= len(orgID) && key[:len(orgID)] == orgID && !seen[p.ID] {
			seen[p.ID] = true
			out = append(out, p)
		}
	}
	return out, nil
}

func (m *Memory) GetProvider(orgID, id string) (*models.ProviderConfig, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if p, ok := m.providers[orgID+":"+id]; ok {
		return p, nil
	}
	for _, p := range m.providers {
		if p.OrganizationID == orgID && p.ID == id {
			return p, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (m *Memory) DeleteProvider(orgID, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for k, p := range m.providers {
		if p.OrganizationID == orgID && p.ID == id {
			delete(m.providers, k)
		}
	}
	return nil
}

func (m *Memory) ListModels() ([]*models.Model, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []*models.Model
	for _, mod := range m.models {
		out = append(out, mod)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ModelName < out[j].ModelName })
	return out, nil
}

func (m *Memory) UpsertModel(mod *models.Model) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.models[mod.ModelName] = mod
	return nil
}

func (m *Memory) GetModel(name string) (*models.Model, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	mod, ok := m.models[name]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	return mod, nil
}

func defaultPolicy(orgID string) *models.RoutingPolicy {
	return &models.RoutingPolicy{
		OrganizationID: orgID, OptimizationMode: models.OptShadow,
		DefaultModel: "mock-medium", QualityWeight: 0.5, CostWeight: 0.35,
		LatencyWeight: 0.15, SemanticCache: false, SemanticThreshold: 0.92,
		CacheTTLSeconds: 3600, BudgetBehavior: "ALERT_ONLY",
		RateLimitOrgPerMin: 600, RateLimitKeyPerMin: 300, RateLimitIPPerMin: 300,
	}
}

func (m *Memory) GetRoutingPolicy(orgID string) (*models.RoutingPolicy, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if p, ok := m.policies[orgID]; ok {
		return p, nil
	}
	return defaultPolicy(orgID), nil
}

func (m *Memory) SaveRoutingPolicy(p *models.RoutingPolicy) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if p.RateLimitOrgPerMin <= 0 {
		p.RateLimitOrgPerMin = 600
	}
	if p.RateLimitKeyPerMin <= 0 {
		p.RateLimitKeyPerMin = 300
	}
	if p.RateLimitIPPerMin <= 0 {
		p.RateLimitIPPerMin = 300
	}
	m.policies[p.OrganizationID] = p
	return nil
}

func (m *Memory) InsertRequest(r *models.RequestRecord) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if r.ID == "" {
		r.ID = uuid.NewString()
	}
	if r.CreatedAt.IsZero() {
		r.CreatedAt = time.Now().UTC()
	}
	m.requests[r.ID] = r
	m.reqOrder = append(m.reqOrder, r.ID)
	return nil
}

func (m *Memory) ListRequests(orgID string, limit, offset int) ([]*models.RequestRecord, int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var all []*models.RequestRecord
	for i := len(m.reqOrder) - 1; i >= 0; i-- {
		r := m.requests[m.reqOrder[i]]
		if r.OrganizationID == orgID {
			all = append(all, r)
		}
	}
	total := len(all)
	if offset > total {
		return []*models.RequestRecord{}, total, nil
	}
	end := offset + limit
	if end > total || limit <= 0 {
		end = total
	}
	return all[offset:end], total, nil
}

func (m *Memory) GetRequest(orgID, id string) (*models.RequestRecord, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, r := range m.requests {
		if (r.ID == id || r.RequestID == id) && r.OrganizationID == orgID {
			return r, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (m *Memory) InsertRoutingDecision(d *models.RoutingDecision) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if d.ID == "" {
		d.ID = uuid.NewString()
	}
	if d.CreatedAt.IsZero() {
		d.CreatedAt = time.Now().UTC()
	}
	m.decisions[d.RequestID] = d
	return nil
}

func (m *Memory) GetRoutingDecisionByRequest(orgID, requestID string) (*models.RoutingDecision, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	d, ok := m.decisions[requestID]
	if !ok || d.OrganizationID != orgID {
		return nil, fmt.Errorf("not found")
	}
	return d, nil
}

func (m *Memory) InsertProviderAttempt(a *models.ProviderAttempt) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	m.attempts[a.RequestID] = append(m.attempts[a.RequestID], a)
	return nil
}

func (m *Memory) ListProviderAttempts(requestID string) ([]*models.ProviderAttempt, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.attempts[requestID], nil
}

func (m *Memory) InsertSecurityEvent(e *models.SecurityEvent) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if e.ID == "" {
		e.ID = uuid.NewString()
	}
	if e.CreatedAt.IsZero() {
		e.CreatedAt = time.Now().UTC()
	}
	m.secEvents = append(m.secEvents, e)
	return nil
}

func (m *Memory) ListSecurityEvents(orgID string, limit int) ([]*models.SecurityEvent, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []*models.SecurityEvent
	for i := len(m.secEvents) - 1; i >= 0 && len(out) < limit; i-- {
		if m.secEvents[i].OrganizationID == orgID {
			out = append(out, m.secEvents[i])
		}
	}
	return out, nil
}

func (m *Memory) SecurityCounts(orgID string, since time.Time) (map[string]int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	counts := map[string]int{}
	for _, e := range m.secEvents {
		if e.OrganizationID == orgID && e.CreatedAt.After(since) {
			counts[e.Type]++
		}
	}
	return counts, nil
}

func (m *Memory) GetBudget(orgID string) (*models.Budget, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if b, ok := m.budgets[orgID]; ok {
		return b, nil
	}
	return &models.Budget{OrganizationID: orgID}, nil
}

func (m *Memory) SaveBudget(b *models.Budget) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.budgets[b.OrganizationID] = b
	return nil
}

func (m *Memory) SpendSince(orgID string, since time.Time) (float64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var total float64
	for _, r := range m.requests {
		if r.OrganizationID == orgID && r.CreatedAt.After(since) && r.Status == "success" {
			total += r.EstimatedCost
		}
	}
	return total, nil
}

func (m *Memory) InsertAudit(a *models.AuditLog) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	if a.CreatedAt.IsZero() {
		a.CreatedAt = time.Now().UTC()
	}
	m.audits = append(m.audits, a)
	return nil
}

func (m *Memory) ListAudit(orgID string, limit int) ([]*models.AuditLog, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []*models.AuditLog
	for i := len(m.audits) - 1; i >= 0 && len(out) < limit; i-- {
		if m.audits[i].OrganizationID == orgID {
			out = append(out, m.audits[i])
		}
	}
	return out, nil
}

func (m *Memory) UpsertCacheEntry(orgID, cacheKey, modelClass, sysHash, paramsHash, response string, embedding []float32, expires time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cache[orgID+":"+cacheKey] = cacheEntry{orgID: orgID, modelCls: modelClass, response: response, embedding: embedding, expires: expires}
	return nil
}

func (m *Memory) GetCacheEntry(orgID, cacheKey string) (string, int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	e, ok := m.cache[orgID+":"+cacheKey]
	if !ok || time.Now().After(e.expires) {
		return "", 0, fmt.Errorf("miss")
	}
	e.hits++
	m.cache[orgID+":"+cacheKey] = e
	return e.response, e.hits, nil
}

func cosine(a, b []float32) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}
	var dot, na, nb float64
	for i := range a {
		dot += float64(a[i] * b[i])
		na += float64(a[i] * a[i])
		nb += float64(b[i] * b[i])
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return dot / (sqrt(na) * sqrt(nb))
}

func sqrt(f float64) float64 {
	// Newton iteration; avoids math import weight in this file (kept simple).
	if f <= 0 {
		return 0
	}
	x := f
	for i := 0; i < 50; i++ {
		x = 0.5 * (x + f/x)
	}
	return x
}

func (m *Memory) SemanticSearch(orgID, modelClass string, embedding []float32, threshold float64, limit int) (string, string, float64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	best, bestKey, bestScore := "", "", 0.0
	for key, e := range m.cache {
		if e.orgID != orgID || e.modelCls != modelClass || time.Now().After(e.expires) {
			continue
		}
		s := cosine(e.embedding, embedding)
		if s >= threshold && s > bestScore {
			best, bestKey, bestScore = e.response, key, s
		}
	}
	if best == "" {
		return "", "", 0, fmt.Errorf("miss")
	}
	return best, bestKey, bestScore, nil
}

func (m *Memory) CacheStats(orgID string) (int64, int64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.cacheReqs[orgID], m.cacheHits[orgID], nil
}

func (m *Memory) RecordCacheLookup(orgID string, hit bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cacheReqs[orgID]++
	if hit {
		m.cacheHits[orgID]++
	}
	return nil
}

func (m *Memory) ListAlerts(orgID string) ([]*models.Alert, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []*models.Alert
	for _, a := range m.alerts {
		if a.OrganizationID == orgID {
			out = append(out, a)
		}
	}
	return out, nil
}

func (m *Memory) CreateAlert(a *models.Alert) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	if a.CreatedAt.IsZero() {
		a.CreatedAt = time.Now().UTC()
	}
	m.alerts[a.ID] = a
	return nil
}

func (m *Memory) DeleteAlert(orgID, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if a, ok := m.alerts[id]; ok && a.OrganizationID == orgID {
		delete(m.alerts, id)
	}
	return nil
}

func (m *Memory) InsertRequestMessages(orgID, requestID string, msgs []models.ChatMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []*models.RequestMessage
	for _, mm := range msgs {
		h := fmt.Sprintf("%x", len(mm.Role)+len(mm.Content))
		out = append(out, &models.RequestMessage{ID: uuid.NewString(), OrganizationID: orgID, RequestID: requestID, Role: mm.Role, ContentHash: h, CreatedAt: time.Now().UTC()})
	}
	m.reqMsgs[requestID] = out
	return nil
}

func (m *Memory) InsertRequestUsage(u *models.RequestUsage) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if u.ID == "" {
		u.ID = uuid.NewString()
	}
	m.reqUsage[u.RequestID] = u
	return nil
}

func (m *Memory) InsertRequestCost(c *models.RequestCost) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c.ID == "" {
		c.ID = uuid.NewString()
	}
	m.reqCosts[c.RequestID] = c
	return nil
}

func (m *Memory) UpsertModelPrice(p *models.ModelPrice) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	m.modelPrices[p.ModelName] = p
	return nil
}

func (m *Memory) ListModelPrices() ([]*models.ModelPrice, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []*models.ModelPrice
	for _, p := range m.modelPrices {
		out = append(out, p)
	}
	return out, nil
}
