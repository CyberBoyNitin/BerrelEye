package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/models"
)

// Anthropic adapts the Messages API (anthropic-version pinned).
type Anthropic struct{}

func (Anthropic) Name() string { return "anthropic" }

var anthropicHTTP = &http.Client{Timeout: 120 * time.Second}

func anthropicHeaders(req *http.Request, apiKey string) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
}

func toAnthropicMessages(ms []models.ChatMessage) (string, []map[string]string) {
	system := ""
	var msgs []map[string]string
	for _, m := range ms {
		if m.Role == "system" {
			if system != "" {
				system += "\n"
			}
			system += m.Content
			continue
		}
		role := m.Role
		if role != "user" && role != "assistant" {
			role = "user"
		}
		msgs = append(msgs, map[string]string{"role": role, "content": m.Content})
	}
	return system, msgs
}

func (Anthropic) ChatCompletion(ctx context.Context, model string, messages []models.ChatMessage, p Params, apiKey, baseURL string) (*Result, error) {
	system, msgs := toAnthropicMessages(messages)
	body := map[string]any{"model": model, "messages": msgs, "stream": false}
	if system != "" {
		body["system"] = system
	}
	if p.Temperature != nil {
		body["temperature"] = *p.Temperature
	}
	maxTok := 1024
	if p.MaxTokens != nil {
		maxTok = *p.MaxTokens
	}
	body["max_tokens"] = maxTok
	if p.Stop != nil {
		body["stop_sequences"] = p.Stop
	}
	if p.Tools != nil {
		body["tools"] = p.Tools
	}
	raw, _ := json.Marshal(body)
	url := strings.TrimRight(baseURL, "/") + "/v1/messages"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	anthropicHeaders(req, apiKey)
	resp, err := anthropicHTTP.Do(req)
	if err != nil {
		return nil, &ProviderError{Retryable: true, Message: "upstream network failure: " + err.Error()}
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if resp.StatusCode == 429 || resp.StatusCode >= 500 {
		return nil, &ProviderError{Retryable: true, StatusCode: resp.StatusCode, Message: fmt.Sprintf("anthropic %d: %s", resp.StatusCode, string(b))}
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &ProviderError{Retryable: false, StatusCode: resp.StatusCode, Message: fmt.Sprintf("anthropic %d: %s", resp.StatusCode, string(b))}
	}
	var out struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		Usage struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
		StopReason string `json:"stop_reason"`
	}
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, err
	}
	var sb strings.Builder
	for _, c := range out.Content {
		sb.WriteString(c.Text)
	}
	in, ot := out.Usage.InputTokens, out.Usage.OutputTokens
	est := false
	if in == 0 && ot == 0 {
		joined := system
		for _, m := range messages {
			joined += "\n" + m.Content
		}
		in = EstimateTokens(joined)
		ot = EstimateTokens(sb.String())
		est = true
	}
	return &Result{Content: sb.String(), InputTokens: in, OutputTokens: ot, Estimated: est, FinishReason: out.StopReason}, nil
}

func (a Anthropic) StreamChatCompletion(ctx context.Context, model string, messages []models.ChatMessage, p Params, apiKey, baseURL string, emit func(StreamChunk) error) (*Result, error) {
	// V1 streams via full request then replays deltas: correct but not
	// bit-forwarded. Documented limitation; non-streaming path is exact.
	res, err := a.ChatCompletion(ctx, model, messages, p, apiKey, baseURL)
	if err != nil {
		return nil, err
	}
	const step = 64
	for i := 0; i < len(res.Content); i += step {
		end := i + step
		if end > len(res.Content) {
			end = len(res.Content)
		}
		if err := emit(StreamChunk{Delta: res.Content[i:end]}); err != nil {
			return nil, err
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(5 * time.Millisecond):
		}
	}
	_ = emit(StreamChunk{Done: true, InputTokens: res.InputTokens, OutputTokens: res.OutputTokens, Estimated: res.Estimated})
	return res, nil
}

func (Anthropic) HealthCheck(ctx context.Context, apiKey, baseURL string) error {
	url := strings.TrimRight(baseURL, "/") + "/v1/models"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	anthropicHeaders(req, apiKey)
	resp, err := anthropicHTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("health %d", resp.StatusCode)
	}
	return nil
}
