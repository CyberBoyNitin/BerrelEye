package usage

import (
	"testing"

	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/models"
)

func TestCostFormula(t *testing.T) {
	m := &models.Model{InputPrice: 1.0, OutputPrice: 3.0} // per 1M
	// 1M in + 1M out = $4
	if got := Calculate(1000000, 1000000, m); got != 4.0 {
		t.Fatalf("got %v want 4.0", got)
	}
	// 1000 in + 500 out
	want := 1000.0/1e6*1.0 + 500.0/1e6*3.0
	if got := Calculate(1000, 500, m); got != want {
		t.Fatalf("got %v want %v", got, want)
	}
	if got := Calculate(10, 10, nil); got != 0 {
		t.Fatalf("nil model must cost 0, got %v", got)
	}
}
