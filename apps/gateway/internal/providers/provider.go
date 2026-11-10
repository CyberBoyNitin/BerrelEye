// Package providers defines the Provider abstraction and adapters.
// Adding a provider = implement ChatCompletion + StreamChatCompletion +
// HealthCheck in a new file; routing never switches on provider names.
package providers

import (
	"context"

	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/models"
)

type Params struct {
	Temperature      *float64
	MaxTokens        *int
	Stop             any
	ResponseFormat   any
	Tools            any
	Stream           bool
	TopP             *float64
	PresencePenalty  *float64
	FrequencyPenalty *float64
}

type Result struct {
	Content      string
	InputTokens  int
	OutputTokens int
	Estimated    bool // true when usage was estimated, not provider-reported
	FinishReason string
}

type StreamChunk struct {
	Delta string
	Done  bool
	// Usage attached to terminal chunk when the provider reports it.
	InputTokens  int
	OutputTokens int
	Estimated    bool
}

type Provider interface {
	Name() string
	ChatCompletion(ctx context.Context, model string, messages []models.ChatMessage, p Params, apiKey, baseURL string) (*Result, error)
	StreamChatCompletion(ctx context.Context, model string, messages []models.ChatMessage, p Params, apiKey, baseURL string, emit func(StreamChunk) error) (*Result, error)
	HealthCheck(ctx context.Context, apiKey, baseURL string) error
}

// Registry maps provider names to implementations.
var Registry = map[string]Provider{
	"openai":    OpenAI{},
	"anthropic": Anthropic{},
	"compat":    Compat{},
	"mock":      Mock{},
}

func Get(name string) Provider {
	if pr, ok := Registry[name]; ok {
		return pr
	}
	return Registry["mock"]
}

// EstimateTokens approximates tokens as words/0.75 when a provider
// does not return usage. Callers must mark Estimated=true and never
// present the value as exact.
func EstimateTokens(text string) int {
	words := 0
	inWord := false
	for _, r := range text {
		if r == ' ' || r == '\n' || r == '\t' {
			inWord = false
			continue
		}
		if !inWord {
			words++
			inWord = true
		}
	}
	n := int(float64(words) / 0.75)
	if n < 1 && len(text) > 0 {
		n = 1
	}
	return n
}
