package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

func HashPassword(pw string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	return string(b), err
}

func CheckPassword(hash, pw string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw)) == nil
}

// NewAPIKey generates sk_live_<32 random chars>, returning the full key
// (shown once), its prefix, and the sha256 hex stored in the DB.
func NewAPIKey() (full, prefix, hash string, err error) {
	buf := make([]byte, 24)
	if _, err = rand.Read(buf); err != nil {
		return "", "", "", err
	}
	secret := base64.RawURLEncoding.EncodeToString(buf)
	full = "sk_live_" + secret
	prefix = full[:12]
	sum := sha256.Sum256([]byte(full))
	hash = hex.EncodeToString(sum[:])
	return full, prefix, hash, nil
}

func HashKey(full string) string {
	sum := sha256.Sum256([]byte(full))
	return hex.EncodeToString(sum[:])
}

// NewSessionToken returns a random token and its sha256 hash for storage.
func NewSessionToken() (string, string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", "", err
	}
	tok := base64.RawURLEncoding.EncodeToString(buf)
	sum := sha256.Sum256([]byte(tok))
	return tok, hex.EncodeToString(sum[:]), nil
}

func ConstantEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// Redact returns a safe hint like "sk_l...abcd".
func Redact(full string) string {
	if len(full) <= 8 {
		return "****"
	}
	return fmt.Sprintf("%s...%s", full[:4], full[len(full)-4:])
}
