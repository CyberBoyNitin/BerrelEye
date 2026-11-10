package config

import (
	"encoding/base64"
	"fmt"
	"os"
)

type Config struct {
	Port             string
	DatabaseURL      string
	RedisURL         string
	MLServiceURL     string
	EncryptionKey    []byte
	StoreMode        string // "postgres" | "memory" (auto: memory when DATABASE_URL empty/unreachable)
	SeedDemo         bool
	OpenAIBaseURL    string
	AnthropicBaseURL string
	CompatBaseURL    string
	CORSOrigin       string
	SecureCookies    bool
}

func Load() (*Config, error) {
	c := &Config{
		Port:             envOr("PORT", "8080"),
		DatabaseURL:      os.Getenv("DATABASE_URL"),
		RedisURL:         envOr("REDIS_URL", "redis://localhost:6379/0"),
		MLServiceURL:     os.Getenv("ML_SERVICE_URL"),
		StoreMode:        envOr("STORE", ""),
		SeedDemo:         os.Getenv("SEED_DEMO") == "true" || os.Getenv("SEED_DEMO") == "1",
		OpenAIBaseURL:    envOr("OPENAI_BASE_URL", "https://api.openai.com/v1"),
		AnthropicBaseURL: envOr("ANTHROPIC_BASE_URL", "https://api.anthropic.com"),
		CompatBaseURL:    os.Getenv("OPENAI_COMPAT_BASE_URL"),
		CORSOrigin:       envOr("CORS_ORIGIN", "http://localhost:3000"),
		SecureCookies:    os.Getenv("COOKIE_SECURE") == "true" || os.Getenv("COOKIE_SECURE") == "1",
	}
	enc := os.Getenv("ENCRYPTION_KEY")
	if enc == "" {
		// DEVELOPMENT-ONLY fallback. Production must set ENCRYPTION_KEY.
		// Provider secrets stored with this key are marked dev-only.
		c.EncryptionKey = []byte("dev-only-32-byte-key-0123456789ab")
	} else {
		if b, err := base64.StdEncoding.DecodeString(enc); err == nil && len(b) == 32 {
			c.EncryptionKey = b
		} else if len(enc) == 32 {
			c.EncryptionKey = []byte(enc)
		} else {
			return nil, fmt.Errorf("ENCRYPTION_KEY must be base64 of 32 bytes or a 32-char string")
		}
	}
	if c.StoreMode == "" {
		if c.DatabaseURL == "" {
			c.StoreMode = "memory"
		} else {
			c.StoreMode = "postgres"
		}
	}
	return c, nil
}

func envOr(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
