package providers

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/models"
)

// Mock is a deterministic development provider. It never fabricates
// savings or analytics — it returns a clearly-marked synthetic response
// and word-based estimated usage (Estimated=true) so the full gateway
// lifecycle (auth → routing → cost → dashboard) works with no API keys.
type Mock struct{}

func (Mock) Name() string { return "mock" }

func mockReply(model string, messages []models.ChatMessage) string {
	last := ""
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == "user" {
			last = messages[i].Content
			break
		}
	}
	if len(last) > 200 {
		last = last[:200] + "…"
	}
	return fmt.Sprintf("[mock:%s] Echo of your request: %q. Configure a real provider (OPENAI_API_KEY / ANTHROPIC_API_KEY) for production responses.", model, last)
}

func mockUsage(messages []models.ChatMessage, reply string) (int, int) {
	joined := ""
	for _, m := range messages {
		joined += m.Content + "\n"
	}
	return EstimateTokens(joined), EstimateTokens(reply)
}

func (Mock) ChatCompletion(_ context.Context, model string, messages []models.ChatMessage, _ Params, _, _ string) (*Result, error) {
	reply := mockReply(model, messages)
	in, out := mockUsage(messages, reply)
	return &Result{Content: reply, InputTokens: in, OutputTokens: out, Estimated: true, FinishReason: "stop"}, nil
}

func (Mock) StreamChatCompletion(ctx context.Context, model string, messages []models.ChatMessage, _ Params, _, _ string, emit func(StreamChunk) error) (*Result, error) {
	reply := mockReply(model, messages)
	in, out := mockUsage(messages, reply)
	words := strings.Fields(reply)
	var sb strings.Builder
	for i, w := range words {
		chunk := w
		if i < len(words)-1 {
			chunk += " "
		}
		sb.WriteString(chunk)
		if err := emit(StreamChunk{Delta: chunk}); err != nil {
			return nil, err
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(8 * time.Millisecond):
		}
	}
	_ = emit(StreamChunk{Done: true, InputTokens: in, OutputTokens: out, Estimated: true})
	return &Result{Content: reply, InputTokens: in, OutputTokens: out, Estimated: true, FinishReason: "stop"}, nil
}

func (Mock) HealthCheck(_ context.Context, _, _ string) error { return nil }
