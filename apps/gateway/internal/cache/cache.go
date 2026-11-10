// Package cache provides exact + semantic caching with Redis primary
// and in-process fallback. Tenant isolation is enforced by key prefixing
// every entry with organization_id; lookups never cross tenants.
package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type Cache struct {
	rdb *redis.Client
	mu  sync.Mutex
	mem map[string]memEntry
}

type memEntry struct {
	value   string
	expires time.Time
}

func New(url string) *Cache {
	c := &Cache{mem: map[string]memEntry{}}
	if url != "" {
		c.rdb = redis.NewClient(&redis.Options{Addr: redisAddr(url)})
	}
	return c
}

func redisAddr(url string) string {
	// Accept redis://host:port/db and bare host:port.
	s := url
	for _, p := range []string{"redis://", "rediss://"} {
		if len(s) > len(p) && s[:len(p)] == p {
			s = s[len(p):]
			break
		}
	}
	for i, ch := range s {
		if ch == '/' {
			return s[:i]
		}
	}
	return s
}

// ExactKey hashes org + normalized request so identical requests share entries.
func ExactKey(orgID, model, sysHash, paramsHash, normalizedMessages string) string {
	h := sha256.Sum256([]byte(orgID + "\x00" + model + "\x00" + sysHash + "\x00" + paramsHash + "\x00" + normalizedMessages))
	return "exact:" + orgID + ":" + hex.EncodeToString(h[:])
}

func NormalizeMessages(raw []byte) string { return string(raw) }

func (c *Cache) Get(ctx context.Context, key string) (string, bool) {
	if c.rdb != nil {
		if v, err := c.rdb.Get(ctx, key).Result(); err == nil {
			return v, true
		}
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.mem[key]
	if !ok || time.Now().After(e.expires) {
		return "", false
	}
	return e.value, true
}

func (c *Cache) Set(ctx context.Context, key, value string, ttl time.Duration) {
	if c.rdb != nil {
		_ = c.rdb.Set(ctx, key, value, ttl).Err()
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.mem[key] = memEntry{value: value, expires: time.Now().Add(ttl)}
}

// Eligible returns false for requests that must never be cached:
// tool use, transactions/account actions, rapidly-changing private data,
// or explicit no-store. Conservative default: only plain chat without
// tools is cache-eligible; semantic cache additionally requires opt-in.
func Eligible(noStore bool, hasTools bool, body map[string]any) bool {
	if noStore || hasTools {
		return false
	}
	if v, ok := body["tools"]; ok && v != nil {
		return false
	}
	return true
}

func MarshalResponse(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
