package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/auth"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/cache"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/config"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/gateway"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/health"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/observability"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/ratelimit"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/store"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type Server struct {
	cfg     *config.Config
	store   store.Store
	cache   *cache.Cache
	limiter *ratelimit.Limiter
	health  *health.Tracker
	mux     *http.ServeMux
}

func New(cfg *config.Config, st store.Store) *Server {
	var rdb *redis.Client
	if cfg.RedisURL != "" {
		rdb = redis.NewClient(&redis.Options{Addr: redisAddr(cfg.RedisURL)})
		if err := rdb.Ping(context.Background()).Err(); err != nil {
			rdb = nil // degrade gracefully to in-process limiting
		}
	}
	s := &Server{cfg: cfg, store: st, cache: cache.New(cfg.RedisURL), limiter: ratelimit.New(rdb), health: health.New(), mux: http.NewServeMux()}
	s.routes()
	return s
}

func redisAddr(url string) string {
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
	if s == "" {
		return "localhost:6379"
	}
	return s
}

func (s *Server) Handler() http.Handler {
	return s.withMiddleware(s.mux)
}

func (s *Server) deps() *gateway.Deps {
	return &gateway.Deps{Config: s.cfg, Store: s.store, Cache: s.cache, Limiter: s.limiter, Health: s.health}
}

func (s *Server) withMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := s.cfg.CORSOrigin
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Add("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Expose-Headers", "X-Request-Id, Retry-After")
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-AI-Cache, X-Request-Id")
			w.Header().Set("Access-Control-Max-Age", "600")
			w.WriteHeader(204)
			return
		}
		// 1MB payload cap
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		reqID := r.Header.Get("X-Request-Id")
		if reqID == "" {
			reqID = "req_" + uuid.NewString()[:12]
		}
		w.Header().Set("X-Request-Id", reqID)
		t0 := time.Now()
		next.ServeHTTP(w, r)
		observability.Info("request", "method", r.Method, "path", observability.Scrub(r.URL.Path), "latency_ms", time.Since(t0).Milliseconds(), "request_id", reqID)
	})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, r *http.Request, code int, typ, msg string) {
	reqID := w.Header().Get("X-Request-Id")
	writeJSON(w, code, map[string]any{"error": map[string]any{"type": typ, "message": msg, "request_id": reqID}})
}

// sessionAuth resolves the dashboard user from the session cookie.
func (s *Server) sessionAuth(r *http.Request) (userID, orgID string, ok bool) {
	c, err := r.Cookie("berreleye_session")
	if err != nil {
		return "", "", false
	}
	sum := sha256.Sum256([]byte(c.Value))
	u, o, _, err := s.store.GetSession(hex.EncodeToString(sum[:]))
	if err != nil {
		return "", "", false
	}
	// active membership required
	if _, err := s.store.GetMembership(o, u); err != nil {
		return "", "", false
	}
	return u, o, true
}

func (s *Server) requireSession(w http.ResponseWriter, r *http.Request) (string, string, bool) {
	u, o, ok := s.sessionAuth(r)
	if !ok {
		writeErr(w, r, 401, "unauthorized", "Not signed in.")
		return "", "", false
	}
	// allow org switching via header when member
	if hdr := r.Header.Get("X-Org-Id"); hdr != "" {
		if _, err := s.store.GetMembership(hdr, u); err == nil {
			o = hdr
		}
	}
	return u, o, true
}

func sha256hex(v string) string {
	sum := sha256.Sum256([]byte(v))
	return hex.EncodeToString(sum[:])
}

var _ = auth.Redact
var _ = strings.TrimSpace
