// Package ratelimit implements Redis-backed fixed-window limits with an
// in-process fallback so the gateway keeps serving when Redis is down.
package ratelimit

import (
	"context"
	"strconv"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type Limiter struct {
	rdb    *redis.Client
	mu     sync.Mutex
	window map[string][]time.Time
}

func New(rdb *redis.Client) *Limiter {
	return &Limiter{rdb: rdb, window: map[string][]time.Time{}}
}

// Allow reports whether key may proceed under limit requests per minute.
func (l *Limiter) Allow(ctx context.Context, key string, limitPerMin int) bool {
	if limitPerMin <= 0 {
		return true
	}
	if l.rdb != nil {
		n, err := l.rdb.Incr(ctx, "rl:"+key).Result()
		if err == nil {
			if n == 1 {
				_ = l.rdb.Expire(ctx, "rl:"+key, time.Minute).Err()
			}
			return n <= int64(limitPerMin)
		}
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	cut := now.Add(-time.Minute)
	kept := []time.Time{}
	for _, t := range l.window[key] {
		if t.After(cut) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= limitPerMin {
		l.window[key] = kept
		return false
	}
	l.window[key] = append(kept, now)
	return true
}

var _ = strconv.Itoa
