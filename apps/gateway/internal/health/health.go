// Package health tracks lightweight per-provider success/latency state so
// routing can shed load from unhealthy providers without permanently
// disabling them on small samples.
package health

import (
	"sync"
	"time"
)

type Status struct {
	Successes  int64
	Failures   int64
	RateLimits int64
	AvgLatency time.Duration
	LastError  time.Time
}

type Tracker struct {
	mu sync.RWMutex
	m  map[string]*Status
}

func New() *Tracker { return &Tracker{m: map[string]*Status{}} }

func (t *Tracker) Record(provider string, ok bool, rateLimited bool, latency time.Duration) {
	t.mu.Lock()
	defer t.mu.Unlock()
	s := t.m[provider]
	if s == nil {
		s = &Status{}
		t.m[provider] = s
	}
	if ok {
		s.Successes++
	} else {
		s.Failures++
		s.LastError = time.Now()
	}
	if rateLimited {
		s.RateLimits++
	}
	if s.AvgLatency == 0 {
		s.AvgLatency = latency
	} else {
		s.AvgLatency = (s.AvgLatency + latency) / 2
	}
}

// Degraded reports true only with enough samples (n>=10) and error rate >50%.
func (t *Tracker) Degraded(provider string) bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	s := t.m[provider]
	if s == nil {
		return false
	}
	total := s.Successes + s.Failures
	if total < 10 {
		return false
	}
	return float64(s.Failures)/float64(total) > 0.5
}

// SuccessRate for dashboards; -1 when no data (must not be rendered as 0%).
func (t *Tracker) SuccessRate(provider string) float64 {
	t.mu.RLock()
	defer t.mu.RUnlock()
	s := t.m[provider]
	if s == nil || s.Successes+s.Failures == 0 {
		return -1
	}
	return float64(s.Successes) / float64(s.Successes+s.Failures)
}
