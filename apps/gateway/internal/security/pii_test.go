package security

import "testing"

func TestDetectEmailPhoneSecret(t *testing.T) {
	text := "contact john@gmail.com or +1-555-123-4567, key sk-abcDEF1234567890"
	got := Detect(text)
	types := map[string]bool{}
	for _, f := range got {
		types[f.Type] = true
	}
	for _, want := range []string{"email", "phone", "secret"} {
		if !types[want] {
			t.Fatalf("expected %s detection, got %+v", want, got)
		}
	}
}

func TestLuhnFiltersNonCards(t *testing.T) {
	if len(Detect("order 12345 total 99")) != 0 {
		t.Fatal("short numbers must not match credit_card")
	}
	// Valid Luhn test number
	got := Detect("card 4111 1111 1111 1111")
	found := false
	for _, f := range got {
		if f.Type == "credit_card" {
			found = true
		}
	}
	if !found {
		t.Fatal("valid Luhn number should be flagged")
	}
}

func TestTokenizerRequestScopedAndConsistent(t *testing.T) {
	tok := NewTokenizer()
	text := "mail john@gmail.com twice john@gmail.com"
	out := tok.Tokenize(text, Detect(text))
	if out != "mail [EMAIL_1] twice [EMAIL_1]" {
		t.Fatalf("repeated entity must map consistently: %s", out)
	}
	if got := tok.Restore(out); got != text {
		t.Fatalf("restore failed: %s", got)
	}
	// Fresh tokenizer restarts numbering: scope is per-request.
	tok2 := NewTokenizer()
	out2 := tok2.Tokenize("x john@gmail.com", Detect("x john@gmail.com"))
	if out2 != "x [EMAIL_1]" {
		t.Fatalf("tokenizer must be request-scoped: %s", out2)
	}
}
