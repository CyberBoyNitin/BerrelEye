.PHONY: dev migrate seed test gateway ml web

dev:
	docker compose up --build

gateway:
	cd apps/gateway && go run ./cmd/server

ml:
	cd apps/ml-service && uvicorn app:app --port 8001 --reload

web:
	cd apps/web && npm run dev

migrate:
	@echo "Migrations run automatically on gateway boot (postgres mode)."

seed:
	@echo "Set SEED_DEMO=true to seed demo org + registry on boot."

test:
	cd apps/gateway && go test ./... 2>&1 | tail -20
	cd apps/ml-service && python -m pytest -q
	cd apps/web && npx tsc --noEmit
