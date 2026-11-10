package store

import (
	"context"
	"os"
	"path/filepath"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Postgres is the production Store backed by PostgreSQL + pgvector.
// Semantic vectors use pgvector cosine distance when available;
// the migration creates the extension but the code degrades to
// exact-cache-only if the extension is missing.
type Postgres struct {
	pool *pgxpool.Pool
	mem  *Memory // fallback for sessions? no — sessions live in postgres
}

func NewPostgres(ctx context.Context, url string) (*Postgres, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Postgres{pool: pool}, nil
}

func (p *Postgres) Close() { p.pool.Close() }

// Migrate applies infra/migrations/*.sql in lexical order.
// In Docker the files are copied to ./migrations; locally they are
// resolved relative to the gateway working directory.
func (p *Postgres) Migrate(ctx context.Context) error {
	dirs := []string{"migrations", "../../infra/migrations", "./infra/migrations"}
	var dir string
	for _, d := range dirs {
		if st, err := os.Stat(d); err == nil && st.IsDir() {
			dir = d
			break
		}
	}
	if dir == "" {
		return nil // nothing to apply (tests use Memory)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if e.IsDir() || len(e.Name()) < 5 || e.Name()[len(e.Name())-4:] != ".sql" {
			continue
		}
		sql, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			return err
		}
		if _, err := p.pool.Exec(ctx, string(sql)); err != nil {
			return err
		}
	}
	return nil
}
