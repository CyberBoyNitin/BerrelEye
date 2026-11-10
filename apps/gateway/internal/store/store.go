package store

import (
	"time"

	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/models"
)

// Store is the durable persistence abstraction. Postgres is the
// production implementation; Memory backs local dev when no
// DATABASE_URL is configured and powers unit tests.
type Store interface {
	// orgs / users
	CreateOrganization(name, slug string) (*models.Organization, error)
	GetOrganization(id string) (*models.Organization, error)
	ListOrganizationsForUser(userID string) ([]*models.Organization, error)
	CreateUser(email, passwordHash string) (*models.User, error)
	GetUserByEmail(email string) (*models.User, error)
	GetUser(id string) (*models.User, error)
	AddMembership(orgID, userID, role string) error
	GetMembership(orgID, userID string) (*models.Membership, error)
	ListMembers(orgID string) ([]*models.Membership, error)

	// sessions
	CreateSession(userID, orgID, tokenHash string, expires time.Time) error
	GetSession(tokenHash string) (userID, orgID string, expires time.Time, err error)
	DeleteSession(tokenHash string) error

	// api keys
	CreateAPIKey(k *models.APIKey) error
	GetAPIKeyByHash(hash string) (*models.APIKey, error)
	ListAPIKeys(orgID string) ([]*models.APIKey, error)
	TouchAPIKey(id string) error
	RevokeAPIKey(orgID, id string) error

	// providers
	UpsertProvider(p *models.ProviderConfig) error
	ListProviders(orgID string) ([]*models.ProviderConfig, error)
	GetProvider(orgID, id string) (*models.ProviderConfig, error)
	DeleteProvider(orgID, id string) error

	// models registry (global + org overrides simplified to global list)
	ListModels() ([]*models.Model, error)
	UpsertModel(m *models.Model) error
	GetModel(name string) (*models.Model, error)

	// routing policy
	GetRoutingPolicy(orgID string) (*models.RoutingPolicy, error)
	SaveRoutingPolicy(p *models.RoutingPolicy) error

	// requests & telemetry
	InsertRequest(r *models.RequestRecord) error
	ListRequests(orgID string, limit, offset int) ([]*models.RequestRecord, int, error)
	GetRequest(orgID, id string) (*models.RequestRecord, error)
	InsertRoutingDecision(d *models.RoutingDecision) error
	GetRoutingDecisionByRequest(orgID, requestID string) (*models.RoutingDecision, error)
	InsertProviderAttempt(a *models.ProviderAttempt) error
	ListProviderAttempts(requestID string) ([]*models.ProviderAttempt, error)
	InsertSecurityEvent(e *models.SecurityEvent) error
	ListSecurityEvents(orgID string, limit int) ([]*models.SecurityEvent, error)
	SecurityCounts(orgID string, since time.Time) (map[string]int, error)

	// budgets / audit
	GetBudget(orgID string) (*models.Budget, error)
	SaveBudget(b *models.Budget) error
	SpendSince(orgID string, since time.Time) (float64, error)
	InsertAudit(a *models.AuditLog) error
	ListAudit(orgID string, limit int) ([]*models.AuditLog, error)

	// cache entries (durable semantic cache; exact cache may live in Redis only)
	UpsertCacheEntry(orgID, cacheKey, modelClass, sysHash, paramsHash, response string, embedding []float32, expires time.Time) error
	GetCacheEntry(orgID, cacheKey string) (response string, hits int, err error)
	SemanticSearch(orgID, modelClass string, embedding []float32, threshold float64, limit int) (response, cacheKey string, score float64, err error)
	CacheStats(orgID string) (requests, hits int64, err error)
	RecordCacheLookup(orgID string, hit bool) error

	// alerts
	ListAlerts(orgID string) ([]*models.Alert, error)
	CreateAlert(a *models.Alert) error
	DeleteAlert(orgID, id string) error

	// normalized request telemetry (prompt.md §6)
	InsertRequestMessages(orgID, requestID string, msgs []models.ChatMessage) error
	InsertRequestUsage(u *models.RequestUsage) error
	InsertRequestCost(c *models.RequestCost) error
	UpsertModelPrice(p *models.ModelPrice) error
	ListModelPrices() ([]*models.ModelPrice, error)
}
