package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/gateway"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/models"
)

func (s *Server) routes() {
	// OpenAI-compatible gateway surface
	s.mux.HandleFunc("/v1/chat/completions", s.handleChatCompletions)
	s.mux.HandleFunc("/v1/models", s.handleModels)
	s.mux.HandleFunc("/health", s.handleHealth)
	s.mux.HandleFunc("/ready", s.handleReady)

	// Dashboard auth
	s.mux.HandleFunc("/api/auth/signup", s.handleSignup)
	s.mux.HandleFunc("/api/auth/login", s.handleLogin)
	s.mux.HandleFunc("/api/auth/logout", s.handleLogout)
	s.mux.HandleFunc("/api/auth/me", s.handleMe)

	// Dashboard resources (primary)
	s.mux.HandleFunc("/api/keys", s.handleKeys)
	s.mux.HandleFunc("/api/keys/", s.handleKeyByID)
	s.mux.HandleFunc("/api/providers", s.handleProviders)
	s.mux.HandleFunc("/api/providers/", s.handleProviderByID)
	s.mux.HandleFunc("/api/models", s.handleRegistry)
	s.mux.HandleFunc("/api/routing", s.handleRouting)
	s.mux.HandleFunc("/api/requests", s.handleRequests)
	s.mux.HandleFunc("/api/requests/", s.handleRequestDetail)
	s.mux.HandleFunc("/api/dashboard/overview", s.handleOverview)
	s.mux.HandleFunc("/api/analytics/models", s.handleModelAnalytics)
	s.mux.HandleFunc("/api/analytics/providers", s.handleProviderAnalytics)
	s.mux.HandleFunc("/api/analytics/cache", s.handleCacheAnalytics)
	s.mux.HandleFunc("/api/security/events", s.handleSecurityEvents)
	s.mux.HandleFunc("/api/budgets", s.handleBudgets)
	s.mux.HandleFunc("/api/audit", s.handleAudit)
	s.mux.HandleFunc("/api/onboarding", s.handleOnboarding)
	// Unified settings + members + alerts
	s.mux.HandleFunc("/api/settings", s.handleSettings)
	s.mux.HandleFunc("/api/members", s.handleMembers)
	s.mux.HandleFunc("/api/alerts", s.handleAlerts)
	s.mux.HandleFunc("/api/alerts/", s.handleAlertByID)
	s.mux.HandleFunc("/api/security/summary", s.handleSecuritySummary)
	// Frontend-expected aliases (all point at the same handlers, no breaking change)
	s.mux.HandleFunc("/api/dashboard/settings", s.handleSettings)
	s.mux.HandleFunc("/api/organizations/me/settings", s.handleSettings)
	s.mux.HandleFunc("/api/routing/policy", s.handleRouting)
	s.mux.HandleFunc("/api/dashboard/requests", s.handleRequests)
	s.mux.HandleFunc("/api/dashboard/requests/", s.handleRequestDetail)
	s.mux.HandleFunc("/api/dashboard/models", s.handleModelAnalytics)
	s.mux.HandleFunc("/api/dashboard/keys", s.handleKeys)
	s.mux.HandleFunc("/api/dashboard/security/events", s.handleSecurityEvents)
	s.mux.HandleFunc("/api/dashboard/security", s.handleSecuritySummary)
	s.mux.HandleFunc("/api/security/events/summary", s.handleSecuritySummary)
	s.mux.HandleFunc("/api/analytics/overview", s.handleOverview)
	s.mux.HandleFunc("/api/overview", s.handleOverview)
	s.mux.HandleFunc("/api/dashboard/providers", s.handleProviders)
	s.mux.HandleFunc("/api/dashboard/audit", s.handleAudit)
	s.mux.HandleFunc("/api/model-prices", s.handleModelPrices)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]any{"status": "ok"})
}

func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]any{"ready": true, "store": s.cfg.StoreMode})
}

func (s *Server) handleModels(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, r, 405, "method_not_allowed", "Use GET.")
		return
	}
	models_, err := s.store.ListModels()
	if err != nil {
		writeErr(w, r, 500, "internal", "Could not list models.")
		return
	}
	data := []any{}
	for _, m := range models_ {
		if !m.Enabled {
			continue
		}
		data = append(data, map[string]any{
			"id":                 m.ModelName,
			"object":             "model",
			"owned_by":           m.Provider,
			"context_window":     m.ContextWindow,
			"capabilities":       m.Capabilities,
			"supports_streaming": m.SupportsStream,
			"supports_tools":     m.SupportsTools,
			"supports_json":      m.SupportsJSON,
			"quality_tier":       m.QualityTier,
			"latency_tier":       m.LatencyTier,
			"pricing": map[string]any{
				"input_per_1m":  m.InputPrice,
				"output_per_1m": m.OutputPrice,
			},
		})
	}
	writeJSON(w, 200, map[string]any{"object": "list", "data": data})
}

func (s *Server) handleChatCompletions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, r, 405, "method_not_allowed", "Use POST.")
		return
	}
	a, err := gateway.AuthenticateGateway(s.store, r.Header.Get("Authorization"))
	if err != nil {
		writeErr(w, r, 401, "invalid_api_key", "Invalid API key.")
		return
	}
	var req models.ChatCompletionRequest
	dec := json.NewDecoder(r.Body)
	dec.UseNumber()
	var raw map[string]any
	if err := dec.Decode(&raw); err != nil {
		writeErr(w, r, 400, "invalid_request", "Malformed JSON.")
		return
	}
	rawBytes, _ := json.Marshal(raw)
	// explicit unsupported-param guard: reject unknown top-level fields that change behavior
	allowed := map[string]bool{"model": true, "messages": true, "temperature": true, "max_tokens": true, "max_completion_tokens": true, "stream": true, "stop": true, "response_format": true, "tools": true, "top_p": true, "presence_penalty": true, "frequency_penalty": true}
	for k := range raw {
		if !allowed[k] {
			writeErr(w, r, 400, "unsupported_parameter", "Unsupported parameter: "+k)
			return
		}
	}
	if err := json.Unmarshal(rawBytes, &req); err != nil {
		writeErr(w, r, 400, "invalid_request", "Invalid request shape.")
		return
	}
	deps := s.deps()
	clientIP := r.Header.Get("X-Forwarded-For")
	if clientIP == "" {
		clientIP = r.RemoteAddr
		if i := len(clientIP); i > 0 {
			for j := len(clientIP) - 1; j >= 0; j-- {
				if clientIP[j] == ':' {
					clientIP = clientIP[:j]
					break
				}
			}
		}
	} else {
		if idx := len(clientIP); idx > 0 {
			parts := strings.Split(clientIP, ",")
			clientIP = strings.TrimSpace(parts[0])
		}
	}
	if req.Stream {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		flusher, ok := w.(http.Flusher)
		if !ok {
			writeErr(w, r, 500, "internal", "Streaming unsupported.")
			return
		}
		requestID := w.Header().Get("X-Request-Id")
		if rec, err := gateway.ProxyStreamWithIP(r.Context(), deps, &gateway.AuthResult{OrgID: a.OrgID, KeyID: a.KeyID, KeyEnv: a.KeyEnv, RawKey: a.RawKey}, req, requestID, clientIP, w, flusher); err != nil {
			if rec != nil && rec.Error == "Rate limit exceeded." {
				// too late for headers; log only
				return
			}
			return
		}
		return
	}
	res, err := gateway.Execute(r.Context(), deps, &gateway.AuthResult{OrgID: a.OrgID, KeyID: a.KeyID, KeyEnv: a.KeyEnv, RawKey: a.RawKey}, req, gateway.ExecInput{RawBody: rawBytes, NoStore: strings.EqualFold(r.Header.Get("X-AI-Cache"), "no-store"), RequestID: w.Header().Get("X-Request-Id"), ClientIP: clientIP})
	if err != nil {
		writeErr(w, r, 500, "internal", "Internal error.")
		return
	}
	if res.RetryAfter > 0 {
		w.Header().Set("Retry-After", "60")
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(res.StatusCode)
	_, _ = w.Write(res.ResponseBody)
}
