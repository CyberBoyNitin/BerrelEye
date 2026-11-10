from fastapi.testclient import TestClient

from app import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_email_detection():
    r = client.post("/pii/detect", json={"text": "contact me at alice@example.com thanks"})
    assert r.status_code == 200
    body = r.json()
    assert any(f["type"] == "email" for f in body["findings"]), body
    assert "alice@example.com" not in body["redacted_text"]
    assert body["warning"] == "deterministic fallback; not exhaustive"


def test_embed_dim():
    r = client.post("/embed", json={"text": "hello"})
    assert r.status_code == 200
    assert len(r.json()["embedding"]) == 128


def test_classify_coding():
    r = client.post("/classify", json={"messages": [{"role": "user", "content": "fix this python bug"}]})
    assert r.status_code == 200
    assert r.json()["category"] == "CODING"
