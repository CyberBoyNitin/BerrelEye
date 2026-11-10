package gateway

import (
	"testing"

	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/models"
)

// Local-testing sentinel fallback (prompt.md): only the exact sentinel key
// swaps the upstream credential for env-provided ones; everything else must
// keep the stored key byte-for-byte.
func TestUpstreamKeyFor(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "env-openai-key")
	t.Setenv("TOGETHERAI_API_KEY", "env-together-key")

	if got := upstreamKeyFor(LocalTestClientKey, "stored-secret"); got != "env-openai-key" {
		t.Fatalf("sentinel should use OPENAI_API_KEY, got %q", got)
	}
	if got := upstreamKeyFor("sk_live_anything-else", "stored-secret"); got != "stored-secret" {
		t.Fatalf("ordinary key must keep stored secret, got %q", got)
	}
	if got := upstreamKeyFor("", "stored-secret"); got != "stored-secret" {
		t.Fatalf("empty key must keep stored secret, got %q", got)
	}
	// Near-miss must NOT trigger (strict equality).
	if got := upstreamKeyFor(LocalTestClientKey+"-x", "stored-secret"); got != "stored-secret" {
		t.Fatalf("near-miss key must keep stored secret, got %q", got)
	}
}

func TestUpstreamKeyForTogetherFallback(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "")
	t.Setenv("TOGETHERAI_API_KEY", "env-together-key")

	if got := upstreamKeyFor(LocalTestClientKey, "stored-secret"); got != "env-together-key" {
		t.Fatalf("sentinel should fall back to TOGETHERAI_API_KEY, got %q", got)
	}
}

func TestUpstreamKeyForNoEnvKeepsStored(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "")
	t.Setenv("TOGETHERAI_API_KEY", "")

	if got := upstreamKeyFor(LocalTestClientKey, "stored-secret"); got != "stored-secret" {
		t.Fatalf("sentinel with no env set must keep stored secret, got %q", got)
	}
}

// Testing Isolation Layer (prompt.md): sentinel + empty provider env key
// simulates; everything else passes through to live providers.
func TestSimulatedLocalResult(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "")
	t.Setenv("TOGETHERAI_API_KEY", "")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("OPENAI_COMPAT_API_KEY", "")

	msgs := []models.ChatMessage{{Role: "user", Content: "hello"}}
	sim := simulatedLocalResult(LocalTestClientKey, "openai", "gpt-4o-mini", msgs)
	if sim == nil {
		t.Fatal("sentinel with empty provider key must simulate")
	}
	if want := "Universal Gateway Success: Live pipeline verified for model gpt-4o-mini."; sim.Content != want {
		t.Fatalf("unexpected simulated content %q", sim.Content)
	}
	if !sim.Estimated || sim.FinishReason != "stop" {
		t.Fatalf("simulated result must be estimated with stop reason: %+v", sim)
	}
	if sim.InputTokens <= 0 || sim.OutputTokens <= 0 {
		t.Fatalf("simulated result must carry estimated usage: %+v", sim)
	}

	// Real callers bypass the layer completely.
	if got := simulatedLocalResult("sk_live_real-user-key", "openai", "gpt-4o-mini", msgs); got != nil {
		t.Fatalf("real user key must hit live providers, got %+v", got)
	}
	// Mock provider never needs interception (already local).
	if got := simulatedLocalResult(LocalTestClientKey, "mock", "mock-medium", msgs); got != nil {
		t.Fatalf("mock provider must not simulate, got %+v", got)
	}
	// Near-miss sentinel must not trigger.
	if got := simulatedLocalResult(LocalTestClientKey+"-x", "openai", "gpt-4o-mini", msgs); got != nil {
		t.Fatalf("near-miss key must hit live providers, got %+v", got)
	}
}

func TestSimulatedLocalResultBypassWhenKeyConfigured(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "env-openai-key")
	t.Setenv("ANTHROPIC_API_KEY", "env-anthropic-key")

	msgs := []models.ChatMessage{{Role: "user", Content: "hello"}}
	if got := simulatedLocalResult(LocalTestClientKey, "openai", "gpt-4o", msgs); got != nil {
		t.Fatalf("configured provider key must use live upstream, got %+v", got)
	}
	if got := simulatedLocalResult(LocalTestClientKey, "anthropic", "claude-3-5-sonnet", msgs); got != nil {
		t.Fatalf("configured provider key must use live upstream, got %+v", got)
	}
	// Compat honors either compat or together keys.
	t.Setenv("OPENAI_COMPAT_API_KEY", "")
	t.Setenv("TOGETHERAI_API_KEY", "env-together-key")
	if got := simulatedLocalResult(LocalTestClientKey, "compat", "compat-cheap", msgs); got != nil {
		t.Fatalf("configured compat key must use live upstream, got %+v", got)
	}
}
