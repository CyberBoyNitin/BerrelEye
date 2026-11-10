package usage

import "github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/models"

// Calculate implements: input_cost = in/1M * input_price,
// output_cost = out/1M * output_price. Prices come from the model
// registry — never hard-coded.
func Calculate(in, out int, m *models.Model) (total float64) {
	if m == nil {
		return 0
	}
	return float64(in)/1e6*m.InputPrice + float64(out)/1e6*m.OutputPrice
}
