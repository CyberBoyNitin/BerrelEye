package main

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/api"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/config"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/observability"
	"github.com/CyberBoyNitin/BerrelEye/apps/gateway/internal/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, "config:", err)
		os.Exit(1)
	}
	ctx := context.Background()
	var st store.Store
	if cfg.StoreMode == "postgres" {
		pg, err := store.NewPostgres(ctx, cfg.DatabaseURL)
		if err != nil {
			observability.Info("postgres unreachable, falling back to memory store")
			st = store.NewMemory()
		} else {
			if err := pg.Migrate(ctx); err != nil {
				fmt.Fprintln(os.Stderr, "migrate:", err)
				os.Exit(1)
			}
			st = pg
		}
	} else {
		st = store.NewMemory()
	}
	Seed(st, cfg.SeedDemo)
	srv := api.New(cfg, st)
	addr := ":" + cfg.Port
	observability.Info("gateway listening on " + addr + " store=" + cfg.StoreMode)
	if err := http.ListenAndServe(addr, srv.Handler()); err != nil {
		fmt.Fprintln(os.Stderr, "serve:", err)
		os.Exit(1)
	}
}
