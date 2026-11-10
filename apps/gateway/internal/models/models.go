package models

import "time"

// Optimization modes: OFF | SHADOW | RECOMMEND | AUTO
type OptimizationMode string

const (
	OptOff       OptimizationMode = "OFF"
	OptShadow    OptimizationMode = "SHADOW"
	OptRecommend OptimizationMode = "RECOMMEND"
	OptAuto      OptimizationMode = "AUTO"
)

type Organization struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	CreatedAt time.Time `json:"created_at"`
}

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

type Membership struct {
	ID             string `json:"id"`
	OrganizationID string `json:"organization_id"`
	UserID         string `json:"user_id"`
	Role           string `json:"role"` // admin | member
}

type APIKey struct {
	ID             string     `json:"id"`
	OrganizationID string     `json:"organization_id"`
	Name           string     `json:"name"`
	Environment    string     `json:"environment"`
	KeyPrefix      string     `json:"key_prefix"`
	KeyHash        string     `json:"-"`
	Permissions    string     `json:"permissions"`
	CreatedAt      time.Time  `json:"created_at"`
	LastUsedAt     *time.Time `json:"last_used_at,omitempty"`
	RevokedAt      *time.Time `json:"revoked_at,omitempty"`
}

type ProviderConfig struct {
	ID             string `json:"id"`
	OrganizationID string `json:"organization_id"` // "global" for platform defaults
	Provider       string `json:"provider"`        // openai | anthropic | compat | mock
	Name           string `json:"name"`
	BaseURL        string `json:"base_url"`
	APIKeyCipher   []byte `json:"-"`
	APIKeyHint     string `json:"api_key_hint"`
	DevOnly        bool   `json:"dev_only"`
	Enabled        bool   `json:"enabled"`
}

type Model struct {
	Provider       string   `json:"provider"`
	ModelName      string   `json:"model_name"`
	InputPrice     float64  `json:"input_price"`  // USD per 1M tokens
	OutputPrice    float64  `json:"output_price"` // USD per 1M tokens
	ContextWindow  int      `json:"context_window"`
	Capabilities   []string `json:"capabilities"`
	SupportsStream bool     `json:"supports_streaming"`
	SupportsTools  bool     `json:"supports_tools"`
	SupportsJSON   bool     `json:"supports_json"`
	QualityTier    string   `json:"quality_tier"` // LOW | MEDIUM | HIGH
	LatencyTier    string   `json:"latency_tier"` // LOW | MEDIUM | HIGH
	Enabled        bool     `json:"enabled"`
}

type RoutingPolicy struct {
	OrganizationID     string           `json:"organization_id"`
	OptimizationMode   OptimizationMode `json:"optimization_mode"`
	DefaultModel       string           `json:"default_model"`
	QualityWeight      float64          `json:"quality_weight"`
	CostWeight         float64          `json:"cost_weight"`
	LatencyWeight      float64          `json:"latency_weight"`
	SemanticCache      bool             `json:"semantic_cache_enabled"`
	SemanticThreshold  float64          `json:"semantic_threshold"`
	CacheTTLSeconds    int              `json:"cache_ttl_seconds"`
	BudgetBehavior     string           `json:"budget_behavior"` // BLOCK | DEGRADE_TO_CHEAPER_MODEL | ALERT_ONLY
	RateLimitOrgPerMin int              `json:"rate_limit_org_per_min"`
	RateLimitKeyPerMin int              `json:"rate_limit_key_per_min"`
	RateLimitIPPerMin  int              `json:"rate_limit_ip_per_min"`
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatCompletionRequest struct {
	Model               string        `json:"model"`
	Messages            []ChatMessage `json:"messages"`
	Temperature         *float64      `json:"temperature,omitempty"`
	MaxTokens           *int          `json:"max_tokens,omitempty"`
	MaxCompletionTokens *int          `json:"max_completion_tokens,omitempty"`
	Stream              bool          `json:"stream,omitempty"`
	Stop                any           `json:"stop,omitempty"`
	ResponseFormat      any           `json:"response_format,omitempty"`
	Tools               any           `json:"tools,omitempty"`
}

type RequestRecord struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	APIKeyID       string    `json:"api_key_id"`
	RequestID      string    `json:"request_id"`
	RequestedModel string    `json:"requested_model"`
	SelectedModel  string    `json:"selected_model"`
	Provider       string    `json:"provider"`
	Status         string    `json:"status"`
	Error          string    `json:"error,omitempty"`
	InputTokens    int       `json:"input_tokens"`
	OutputTokens   int       `json:"output_tokens"`
	TotalTokens    int       `json:"total_tokens"`
	EstimatedCost  float64   `json:"estimated_provider_cost"`
	LatencyMs      int64     `json:"latency_ms"`
	TTFTMs         int64     `json:"time_to_first_token_ms"`
	CacheHit       bool      `json:"cache_hit"`
	CacheType      string    `json:"cache_type,omitempty"`
	RoutingMode    string    `json:"routing_mode"`
	RoutingReason  []string  `json:"routing_reason,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type RoutingDecision struct {
	ID                 string    `json:"id"`
	OrganizationID     string    `json:"organization_id"`
	RequestID          string    `json:"request_id"`
	RequestedModel     string    `json:"requested_model"`
	RecommendedModel   string    `json:"recommended_model"`
	SelectedModel      string    `json:"selected_model"`
	ActualCost         float64   `json:"actual_cost"`
	EstimatedOptimized float64   `json:"estimated_optimized_cost"`
	EstimatedSavings   float64   `json:"estimated_savings"`
	RoutingReason      []string  `json:"routing_reason"`
	Category           string    `json:"category"`
	CreatedAt          time.Time `json:"created_at"`
}

type ProviderAttempt struct {
	ID         string `json:"id"`
	RequestID  string `json:"request_id"`
	Provider   string `json:"provider"`
	Model      string `json:"model"`
	Status     string `json:"status"`
	StatusCode int    `json:"status_code"`
	LatencyMs  int64  `json:"latency_ms"`
	Error      string `json:"error,omitempty"`
}

type SecurityEvent struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	RequestID      string    `json:"request_id,omitempty"`
	Type           string    `json:"type"`
	Detail         string    `json:"detail"`
	CreatedAt      time.Time `json:"created_at"`
}

type Budget struct {
	OrganizationID  string   `json:"organization_id"`
	MonthlyBudget   *float64 `json:"monthly_budget,omitempty"`
	DailyBudget     *float64 `json:"daily_budget,omitempty"`
	PerRequestLimit *float64 `json:"per_request_limit,omitempty"`
}

type AuditLog struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	Actor          string    `json:"actor"`
	Action         string    `json:"action"`
	Metadata       string    `json:"metadata,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type Alert struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	Type           string    `json:"type"` // BUDGET_WARNING | BUDGET_ALERT | PROVIDER_UNHEALTHY | RATE_LIMITED
	Threshold      float64   `json:"threshold,omitempty"`
	Channel        string    `json:"channel"` // dashboard | webhook
	Enabled        bool      `json:"enabled"`
	Message        string    `json:"message,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type RequestMessage struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	RequestID      string    `json:"request_id"`
	Role           string    `json:"role"`
	ContentHash    string    `json:"content_hash"`
	CreatedAt      time.Time `json:"created_at"`
}

type RequestUsage struct {
	ID             string `json:"id"`
	OrganizationID string `json:"organization_id"`
	RequestID      string `json:"request_id"`
	InputTokens    int    `json:"input_tokens"`
	OutputTokens   int    `json:"output_tokens"`
	TotalTokens    int    `json:"total_tokens"`
	Estimated      bool   `json:"estimated"`
	LatencyMs      int64  `json:"latency_ms"`
	TTFTMs         int64  `json:"time_to_first_token_ms"`
}

type RequestCost struct {
	ID             string  `json:"id"`
	OrganizationID string  `json:"organization_id"`
	RequestID      string  `json:"request_id"`
	InputCost      float64 `json:"input_cost"`
	OutputCost     float64 `json:"output_cost"`
	TotalCost      float64 `json:"total_cost"`
}

type ModelPrice struct {
	ID          string    `json:"id"`
	ModelName   string    `json:"model_name"`
	InputPrice  float64   `json:"input_price"`
	OutputPrice float64   `json:"output_price"`
	EffectiveAt time.Time `json:"effective_at"`
}
