package routing

import (
	"testing"

	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/models"
)

func registry() []*models.Model {
	return []*models.Model{
		{Provider: "mock", ModelName: "cheap", InputPrice: 0.1, OutputPrice: 0.3, ContextWindow: 16000, Capabilities: []string{"json"}, SupportsJSON: true, QualityTier: "LOW", LatencyTier: "LOW", Enabled: true},
		{Provider: "mock", ModelName: "mid", InputPrice: 1, OutputPrice: 3, ContextWindow: 32000, Capabilities: []string{"coding", "json", "tool_use"}, SupportsJSON: true, SupportsTools: true, QualityTier: "MEDIUM", LatencyTier: "MEDIUM", Enabled: true},
		{Provider: "mock", ModelName: "premium", InputPrice: 5, OutputPrice: 15, ContextWindow: 128000, Capabilities: []string{"coding", "reasoning", "json", "tool_use", "long_context"}, SupportsJSON: true, SupportsTools: true, QualityTier: "HIGH", LatencyTier: "HIGH", Enabled: true},
	}
}

func policy(mode models.OptimizationMode) *models.RoutingPolicy {
	return &models.RoutingPolicy{OrganizationID: "o", OptimizationMode: mode, DefaultModel: "mid", QualityWeight: 0.5, CostWeight: 0.35, LatencyWeight: 0.15}
}

func msgs(s string) []models.ChatMessage {
	return []models.ChatMessage{{Role: "user", Content: s}}
}

func TestOffRespectsExplicitChoice(t *testing.T) {
	d := Select(policy(models.OptOff), "premium", msgs("hello"), nil, nil, registry(), RuleClassifier{})
	if d.SelectedModel != "premium" {
		t.Fatalf("OFF must keep requested model, got %s", d.SelectedModel)
	}
}

func TestAutoRoutesSimpleToCheap(t *testing.T) {
	d := Select(policy(models.OptAuto), "premium", msgs("hello"), nil, nil, registry(), RuleClassifier{})
	if d.SelectedModel == "premium" {
		t.Fatalf("AUTO should move simple task off premium, reasons=%v", d.Reasons)
	}
	if len(d.Reasons) == 0 {
		t.Fatal("decision must be explainable")
	}
}

func TestShadowDoesNotReroute(t *testing.T) {
	d := Select(policy(models.OptShadow), "premium", msgs("hello"), nil, nil, registry(), RuleClassifier{})
	if d.SelectedModel != "premium" {
		t.Fatalf("SHADOW must not reroute production traffic, got %s", d.SelectedModel)
	}
	if d.RecommendedModel == "" {
		t.Fatal("SHADOW must still recommend an alternative")
	}
}

func TestCodingRequiresCapability(t *testing.T) {
	d := Select(policy(models.OptAuto), "cheap", msgs("debug this func main() stacktrace in Go"), nil, nil, registry(), RuleClassifier{})
	if d.SelectedModel == "cheap" {
		t.Fatalf("coding task must not stay on non-coding model: %v", d.Reasons)
	}
	if d.Category != "CODING" {
		t.Fatalf("expected CODING, got %s", d.Category)
	}
}

func TestToolUseRequiresTools(t *testing.T) {
	d := Select(policy(models.OptAuto), "cheap", msgs("search"), map[string]any{"x": 1}, nil, registry(), RuleClassifier{})
	if d.SelectedModel == "cheap" {
		t.Fatal("tool use must route to tool-capable model")
	}
}
