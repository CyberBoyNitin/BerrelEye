package providers

import (
	"bufio"
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

var httpClient = &http.Client{Timeout: 120 * time.Second}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIReq struct {
	Model          string          `json:"model"`
	Messages       []openAIMessage `json:"messages"`
	Temperature    *float64        `json:"temperature,omitempty"`
	MaxTokens      *int            `json:"max_tokens,omitempty"`
	MaxComplTokens *int            `json:"max_completion_tokens,omitempty"`
	Stream         bool            `json:"stream,omitempty"`
	Stop           any             `json:"stop,omitempty"`
	ResponseFormat any             `json:"response_format,omitempty"`
	Tools          any             `json:"tools,omitempty"`
}

type openAIResp struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error"`
}

// OpenAI speaks the OpenAI chat-completions dialect.
type OpenAI struct{}

func (OpenAI) Name() string { return "openai" }

func toOAIMessages(ms []models.ChatMessage) []openAIMessage {
	out := make([]openAIMessage, len(ms))
	for i, m := range ms {
		out[i] = openAIMessage{Role: m.Role, Content: m.Content}
	}
	return out
}

func doOAIRequest(ctx context.Context, baseURL, apiKey string, body openAIReq, stream bool, onLine func(line string) error) (*openAIResp, error) {
	body.Stream = stream
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	url := strings.TrimRight(baseURL, "/") + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, &ProviderError{Retryable: true, StatusCode: 0, Message: "upstream network failure: " + err.Error()}
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, &ProviderError{Retryable: true, StatusCode: resp.StatusCode, Message: fmt.Sprintf("provider %d: %s", resp.StatusCode, string(b))}
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, &ProviderError{Retryable: false, StatusCode: resp.StatusCode, Message: fmt.Sprintf("provider %d: %s", resp.StatusCode, string(b))}
	}
	if !stream {
		var out openAIResp
		if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
			return nil, err
		}
		if out.Error != nil {
			return nil, &ProviderError{Retryable: false, StatusCode: resp.StatusCode, Message: out.Error.Message}
		}
		return &out, nil
	}
	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)
	for sc.Scan() {
		line := sc.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		if err := onLine(line); err != nil {
			return nil, err
		}
	}
	return nil, sc.Err()
}

func (OpenAI) ChatCompletion(ctx context.Context, model string, messages []models.ChatMessage, p Params, apiKey, baseURL string) (*Result, error) {
	body := openAIReq{Model: model, Messages: toOAIMessages(messages), Temperature: p.Temperature, MaxTokens: p.MaxTokens, Stop: p.Stop, ResponseFormat: p.ResponseFormat, Tools: p.Tools}
	if p.MaxTokens == nil && p.TopP == nil {
		_ = p
	}
	resp, err := doOAIRequest(ctx, baseURL, apiKey, body, false, nil)
	if err != nil {
		return nil, err
	}
	if len(resp.Choices) == 0 {
		return nil, &ProviderError{Retryable: false, StatusCode: 502, Message: "provider returned no choices"}
	}
	in, out := resp.Usage.PromptTokens, resp.Usage.CompletionTokens
	est := false
	if in == 0 && out == 0 {
		joined := ""
		for _, m := range messages {
			joined += m.Content + "\n"
		}
		in = EstimateTokens(joined)
		out = EstimateTokens(resp.Choices[0].Message.Content)
		est = true
	}
	return &Result{Content: resp.Choices[0].Message.Content, InputTokens: in, OutputTokens: out, Estimated: est, FinishReason: resp.Choices[0].FinishReason}, nil
}

func (OpenAI) StreamChatCompletion(ctx context.Context, model string, messages []models.ChatMessage, p Params, apiKey, baseURL string, emit func(StreamChunk) error) (*Result, error) {
	body := openAIReq{Model: model, Messages: toOAIMessages(messages), Temperature: p.Temperature, MaxTokens: p.MaxTokens, Stop: p.Stop, ResponseFormat: p.ResponseFormat, Tools: p.Tools}
	var sb strings.Builder
	in, out := 0, 0
	est := true
	_, err := doOAIRequest(ctx, baseURL, apiKey, body, true, func(line string) error {
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			return emit(StreamChunk{Done: true, InputTokens: in, OutputTokens: out, Estimated: est})
		}
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
			Usage *struct {
				PromptTokens     int `json:"prompt_tokens"`
				CompletionTokens int `json:"completion_tokens"`
			} `json:"usage"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			return nil // ignore keep-alives / malformed heartbeats
		}
		if chunk.Usage != nil {
			in, out, est = chunk.Usage.PromptTokens, chunk.Usage.CompletionTokens, false
		}
		for _, c := range chunk.Choices {
			if c.Delta.Content != "" {
				sb.WriteString(c.Delta.Content)
				if err := emit(StreamChunk{Delta: c.Delta.Content}); err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if out == 0 {
		out = EstimateTokens(sb.String())
		joined := ""
		for _, m := range messages {
			joined += m.Content + "\n"
		}
		in = EstimateTokens(joined)
	}
	return &Result{Content: sb.String(), InputTokens: in, OutputTokens: out, Estimated: est, FinishReason: "stop"}, nil
}

func (OpenAI) HealthCheck(ctx context.Context, apiKey, baseURL string) error {
	url := strings.TrimRight(baseURL, "/") + "/models"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("health %d", resp.StatusCode)
	}
	return nil
}

// Compat reuses the OpenAI dialect against any OpenAI-compatible base URL.
type Compat struct{ OpenAI }

func (Compat) Name() string { return "compat" }

// ProviderError distinguishes retryable (429/5xx/network) from terminal failures.
type ProviderError struct {
	Retryable  bool
	StatusCode int
	Message    string
}

func (e *ProviderError) Error() string { return e.Message }
