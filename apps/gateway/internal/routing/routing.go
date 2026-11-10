// Package routing implements the deterministic V1 router.
// Rule-based classification first; the RoutingClassifier interface lets
// the Python ML service replace it later without gateway changes.
package routing

import (
	"fmt"
	"strings"

	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/models"
)

type Classification struct {
	Category   string // SIMPLE | CODING | REASONING | LONG_CONTEXT | STRUCTURED_OUTPUT | TOOL_USE | UNKNOWN
	Complexity string // LOW | MEDIUM | HIGH
	Confidence float64
}

type Classifier interface {
	Classify(messages []models.ChatMessage, tools any, responseFormat any) Classification
}

// RuleClassifier is the deterministic V1 implementation.
type RuleClassifier struct{}

func (RuleClassifier) Classify(messages []models.ChatMessage, tools any, responseFormat any) Classification {
	joined := ""
	for _, m := range messages {
		joined += "\n" + m.Content
	}
	lower := strings.ToLower(joined)
	totalLen := len(joined)

	if tools != nil {
		return Classification{Category: "TOOL_USE", Complexity: "HIGH", Confidence: 0.9}
	}
	if responseFormat != nil {
		return Classification{Category: "STRUCTURED_OUTPUT", Complexity: "MEDIUM", Confidence: 0.9}
	}
	if totalLen > 20000 {
		return Classification{Category: "LONG_CONTEXT", Complexity: "HIGH", Confidence: 0.85}
	}
	codeHints := []string{"```", "func ", "def ", "class ", "import ", "debug", "stacktrace", "compile", "refactor", "sql", "kubernetes", "dockerfile"}
	for _, h := range codeHints {
		if strings.Contains(lower, h) {
			return Classification{Category: "CODING", Complexity: "MEDIUM", Confidence: 0.8}
		}
	}
	reasonHints := []string{"prove", "theorem", "step by step", "analyze", "compare tradeoffs", "why does", "derive", "pros and cons"}
	for _, h := range reasonHints {
		if strings.Contains(lower, h) {
			return Classification{Category: "REASONING", Complexity: "HIGH", Confidence: 0.75}
		}
	}
	if totalLen < 500 && (strings.Contains(lower, "summarize") || strings.Contains(lower, "translate") || strings.Contains(lower, "classify") || strings.Contains(lower, "hello") || strings.HasSuffix(strings.TrimSpace(lower), "?") == false && totalLen < 120) {
		return Classification{Category: "SIMPLE", Complexity: "LOW", Confidence: 0.7}
	}
	if strings.HasSuffix(strings.TrimSpace(lower), "?") && totalLen < 300 {
		return Classification{Category: "SIMPLE", Complexity: "LOW", Confidence: 0.65}
	}
	return Classification{Category: "UNKNOWN", Complexity: "MEDIUM", Confidence: 0.5}
}

type Decision struct {
	SelectedModel    string
	RecommendedModel string
	Reasons          []string
	Category         string
	EstimatedSavings float64 // fraction 0..1 vs requested model cost
}

// qualityScore maps tiers to numeric scores.
func qualityScore(t string) float64 {
	switch t {
	case "HIGH":
		return 1.0
	case "MEDIUM":
		return 0.6
	default:
		return 0.3
	}
}

func latencyScore(t string) float64 {
	switch t {
	case "LOW":
		return 1.0
	case "MEDIUM":
		return 0.6
	default:
		return 0.3
	}
}

func hasCapability(m *models.Model, cap string) bool {
	for _, c := range m.Capabilities {
		if strings.EqualFold(c, cap) {
			return true
		}
	}
	return false
}

// Select implements OFF/SHADOW/RECOMMEND/AUTO semantics.
// OFF: always the requested model. Others: compute the best candidate
// via weighted score but only switch automatically in AUTO.
func Select(
	policy *models.RoutingPolicy,
	requested string,
	messages []models.ChatMessage,
	tools any,
	responseFormat any,
	registry []*models.Model,
	clf Classifier,
) Decision {
	if clf == nil {
		clf = RuleClassifier{}
	}
	c := clf.Classify(messages, tools, responseFormat)

	byName := map[string]*models.Model{}
	for _, m := range registry {
		if m.Enabled {
			byName[m.ModelName] = m
		}
	}
	reqModel, ok := byName[requested]
	if !ok {
		// Unknown requested model: fall back to policy default (explicit, recorded).
		reqModel, ok = byName[policy.DefaultModel]
		if !ok && len(registry) > 0 {
			reqModel = registry[0]
		}
	}

	// Filter candidates by hard capability constraints.
	candidates := []*models.Model{}
	for _, m := range registry {
		if !m.Enabled {
			continue
		}
		switch c.Category {
		case "CODING":
			if !hasCapability(m, "coding") {
				continue
			}
		case "STRUCTURED_OUTPUT":
			if !m.SupportsJSON {
				continue
			}
		case "TOOL_USE":
			if !m.SupportsTools {
				continue
			}
		case "LONG_CONTEXT":
			if m.ContextWindow < 32000 && !hasCapability(m, "long_context") {
				continue
			}
		case "REASONING":
			if !hasCapability(m, "reasoning") {
				continue
			}
		}
		candidates = append(candidates, m)
	}
	if len(candidates) == 0 {
		candidates = registry
	}

	// Weighted score: quality*Q / (cost*C + latency*L) style → linear blend
	// over normalized components for explainability.
	maxCost := 0.0
	for _, m := range candidates {
		avg := (m.InputPrice + m.OutputPrice) / 2
		if avg > maxCost {
			maxCost = avg
		}
	}
	if maxCost == 0 {
		maxCost = 1
	}
	best := reqModel
	bestScore := -1.0
	for _, m := range candidates {
		avg := (m.InputPrice + m.OutputPrice) / 2
		normCost := avg / maxCost
		score := policy.QualityWeight*qualityScore(m.QualityTier) -
			policy.CostWeight*normCost +
			policy.LatencyWeight*latencyScore(m.LatencyTier)
		if score > bestScore {
			bestScore = score
			best = m
		}
	}
	if best == nil {
		best = reqModel
	}

	reasons := []string{}
	switch c.Category {
	case "SIMPLE":
		reasons = append(reasons, "simple task suitable for a low-cost model")
	case "CODING":
		reasons = append(reasons, "coding task routed to a coding-capable model")
	case "REASONING":
		reasons = append(reasons, "complex reasoning task needs a high-quality model")
	case "LONG_CONTEXT":
		reasons = append(reasons, "long context requires a large-context model")
	case "STRUCTURED_OUTPUT":
		reasons = append(reasons, "structured output requires JSON-capable model")
	case "TOOL_USE":
		reasons = append(reasons, "tool use requires a tool-capable model")
	default:
		reasons = append(reasons, "no strong task signal; using policy default trade-off")
	}
	// Cost comparison (per-1K blended estimate).
	blended := func(m *models.Model) float64 { return (m.InputPrice + m.OutputPrice) / 2 }
	savings := 0.0
	if reqModel != nil && blended(reqModel) > 0 {
		savings = (blended(reqModel) - blended(best)) / blended(reqModel)
		if savings < 0 {
			savings = 0
		}
	}
	if best != nil && reqModel != nil && best.ModelName != reqModel.ModelName && savings > 0.05 {
		reasons = append(reasons, fmt.Sprintf("estimated cost %.0f%% lower than requested model", savings*100))
	}
	if best != nil && best.LatencyTier == "LOW" {
		reasons = append(reasons, "lower latency tier")
	}
	reasons = append(reasons, "organization policy allows: "+string(policy.OptimizationMode))

	selected := requested
	if policy.OptimizationMode == "AUTO" && best != nil {
		selected = best.ModelName
	}
	recommended := requested
	if best != nil {
		recommended = best.ModelName
	}
	return Decision{SelectedModel: selected, RecommendedModel: recommended, Reasons: reasons, Category: c.Category, EstimatedSavings: savings}
}
