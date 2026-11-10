# ml-service (optional deterministic fallback)

Minimal FastAPI service: PII regex, hashed 128-dim embeddings, rule-based classifier.

Run: `uvicorn app:app --port 8001`

> Gateway works without this service — it is an optional enhancement.
> PII detection is a deterministic regex fallback, not exhaustive.
