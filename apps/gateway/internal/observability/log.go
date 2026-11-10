// Package observability provides structured request logging with a
// deny-list: API keys, provider secrets, auth headers, card numbers,
// passwords and raw PII must never be logged.
package observability

import (
	"log/slog"
	"regexp"
)

var (
	reCard    = regexp.MustCompile(`\b(?:\d[ \-]?){13,19}\b`)
	reBearer  = regexp.MustCompile(`(?i)Bearer\s+[A-Za-z0-9\-_.~+/=]+`)
	reAPIKey  = regexp.MustCompile(`sk_live_[A-Za-z0-9\-_]+`)
	reSecret  = regexp.MustCompile(`(?i)(api[_-]?key|password|secret)\s*[:=]\s*\S+`)
	reEmailAd = regexp.MustCompile(`[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}`)
)

// Scrub removes sensitive values from a log string.
func Scrub(s string) string {
	s = reAPIKey.ReplaceAllString(s, "sk_live_[REDACTED]")
	s = reBearer.ReplaceAllString(s, "Bearer [REDACTED]")
	s = reSecret.ReplaceAllString(s, "$1=[REDACTED]")
	s = reCard.ReplaceAllStringFunc(s, func(m string) string {
		digits := ""
		for _, r := range m {
			if r >= '0' && r <= '9' {
				digits += string(r)
			}
		}
		if len(digits) >= 13 && len(digits) <= 19 {
			return "[CARD_REDACTED]"
		}
		return m
	})
	s = reEmailAd.ReplaceAllString(s, "[EMAIL_REDACTED]")
	return s
}

func Info(msg string, args ...any) {
	slog.Info(Scrub(msg), args...)
}
