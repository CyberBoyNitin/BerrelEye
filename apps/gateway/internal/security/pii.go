// Package security implements deterministic PII detection + request-scoped
// tokenization. Detection is regex-first and explicitly NOT exhaustive;
// the Python ML service (Presidio-style) is an optional advanced layer.
package security

import (
	"fmt"
	"regexp"
	"strings"
	"sync"
)

type Finding struct {
	Type  string `json:"type"`
	Value string `json:"value"` // redacted in events; never logged raw
	Start int    `json:"start"`
	End   int    `json:"end"`
}

var (
	reEmail  = regexp.MustCompile(`[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}`)
	rePhone  = regexp.MustCompile(`\+?[0-9][0-9\s\-().]{7,}[0-9]`)
	reCard   = regexp.MustCompile(`\b(?:\d[ \-]?){13,19}\b`)
	reIP     = regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`)
	reSecret = regexp.MustCompile(`(?i)(sk-[A-Za-z0-9\-_]{8,}|ghp_[A-Za-z0-9]{8,}|AKIA[0-9A-Z]{16}|xox[bpas]-[A-Za-z0-9\-_]{8,}|bearer\s+[A-Za-z0-9\-_.~+/]+|api[_-]?key\s*[:=]\s*[A-Za-z0-9\-_.]{8,})`)
)

func luhnOK(s string) bool {
	digits := ""
	for _, r := range s {
		if r >= '0' && r <= '9' {
			digits += string(r)
		}
	}
	if len(digits) < 13 || len(digits) > 19 {
		return false
	}
	sum := 0
	alt := false
	for i := len(digits) - 1; i >= 0; i-- {
		d := int(digits[i] - '0')
		if alt {
			d *= 2
			if d > 9 {
				d -= 9
			}
		}
		sum += d
		alt = !alt
	}
	return sum%10 == 0
}

// Detect scans text. Raw values are returned to the caller for
// tokenization but must never be written to logs/analytics — callers
// store only types + counts.
func Detect(text string) []Finding {
	var out []Finding
	for _, loc := range reEmail.FindAllStringIndex(text, -1) {
		out = append(out, Finding{Type: "email", Value: text[loc[0]:loc[1]], Start: loc[0], End: loc[1]})
	}
	for _, loc := range rePhone.FindAllStringIndex(text, -1) {
		v := text[loc[0]:loc[1]]
		digits := 0
		for _, r := range v {
			if r >= '0' && r <= '9' {
				digits++
			}
		}
		if digits >= 7 && digits <= 15 {
			out = append(out, Finding{Type: "phone", Value: v, Start: loc[0], End: loc[1]})
		}
	}
	for _, loc := range reCard.FindAllStringIndex(text, -1) {
		v := text[loc[0]:loc[1]]
		if luhnOK(v) {
			out = append(out, Finding{Type: "credit_card", Value: v, Start: loc[0], End: loc[1]})
		}
	}
	for _, loc := range reIP.FindAllStringIndex(text, -1) {
		out = append(out, Finding{Type: "ip", Value: text[loc[0]:loc[1]], Start: loc[0], End: loc[1]})
	}
	for _, loc := range reSecret.FindAllStringIndex(text, -1) {
		out = append(out, Finding{Type: "secret", Value: text[loc[0]:loc[1]], Start: loc[0], End: loc[1]})
	}
	return out
}

// Tokenizer holds a request-scoped value→token map kept in memory only.
type Tokenizer struct {
	mu      sync.Mutex
	counter map[string]int
	mapping map[string]string // raw value -> token
}

func NewTokenizer() *Tokenizer {
	return &Tokenizer{counter: map[string]int{}, mapping: map[string]string{}}
}

// Tokenize replaces detected raw values with [TYPE_N] placeholders.
// Repeated entities map consistently within the request.
func (t *Tokenizer) Tokenize(text string, findings []Finding) string {
	t.mu.Lock()
	defer t.mu.Unlock()
	// Replace longest values first to avoid partial overlaps.
	order := append([]Finding{}, findings...)
	for i := 0; i < len(order); i++ {
		for j := i + 1; j < len(order); j++ {
			if len(order[j].Value) > len(order[i].Value) {
				order[i], order[j] = order[j], order[i]
			}
		}
	}
	for _, f := range order {
		tok, ok := t.mapping[f.Value]
		if !ok {
			t.counter[f.Type]++
			tok = fmt.Sprintf("[%s_%d]", strings.ToUpper(f.Type), t.counter[f.Type])
			t.mapping[f.Value] = tok
		}
		text = strings.ReplaceAll(text, f.Value, tok)
	}
	return text
}

// Restore swaps placeholders back to raw values in the provider response.
func (t *Tokenizer) Restore(text string) string {
	t.mu.Lock()
	defer t.mu.Unlock()
	for raw, tok := range t.mapping {
		text = strings.ReplaceAll(text, tok, raw)
	}
	return text
}
