"""Minimal deterministic ML fallback service (dependency-free logic, only fastapi+uvicorn)."""
from __future__ import annotations

import hashlib
import math
import re
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="berreleye-ml-service", version="0.1.0")

WARNING = "deterministic fallback; not exhaustive"

# ---------------------------------------------------------------- PII regex
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(
    r"(?:\+\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b"
)
# 13-19 digits allowing spaces/dashes, validated with Luhn.
CC_CANDIDATE_RE = re.compile(r"\b(?:\d[ \-]*?){13,19}\b")
IPV4_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")

SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("secret", re.compile(r"sk-[A-Za-z0-9\-_]{8,}")),
    ("secret", re.compile(r"ghp_[A-Za-z0-9]{8,}")),
    ("secret", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("secret", re.compile(r"Bearer\s+[A-Za-z0-9\-._~+/=]{8,}")),
    (
        "secret",
        re.compile(
            r"(?i)(?:api[_-]?key|secret|token)\s*[:=]\s*['\"]?[A-Za-z0-9\-._~+/=]{8,}['\"]?"
        ),
    ),
]


def _luhn_ok(digits: str) -> bool:
    nums = [int(d) for d in digits]
    total = 0
    for i, d in enumerate(reversed(nums)):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def _valid_ipv4(s: str) -> bool:
    try:
        return all(0 <= int(p) <= 255 for p in s.split("."))
    except ValueError:
        return False


def detect_pii(text: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []

    def add(m_type: str, m: re.Match[str]) -> None:
        findings.append({"type": m_type, "start": m.start(), "end": m.end()})

    for m in EMAIL_RE.finditer(text):
        add("email", m)
    for m in PHONE_RE.finditer(text):
        # avoid flagging pure years / short digit runs already covered; require >=10 digits
        digits = re.sub(r"\D", "", m.group(0))
        if len(digits) >= 10 and len(digits) <= 15:
            add("phone", m)
    for m in CC_CANDIDATE_RE.finditer(text):
        digits = re.sub(r"\D", "", m.group(0))
        if 13 <= len(digits) <= 19 and _luhn_ok(digits):
            add("credit_card", m)
    for m in IPV4_RE.finditer(text):
        if _valid_ipv4(m.group(0)):
            add("ip", m)
    for label, rx in SECRET_PATTERNS:
        for m in rx.finditer(text):
            add(label, m)

    # dedupe + sort; drop spans fully contained in a longer span
    findings.sort(key=lambda f: (f["start"], -(f["end"] - f["start"])))
    kept: list[dict[str, Any]] = []
    for f in findings:
        if any(k["start"] <= f["start"] and f["end"] <= k["end"] for k in kept):
            continue
        kept.append(f)
    return sorted(kept, key=lambda f: f["start"])


def redact(text: str, findings: list[dict[str, Any]]) -> str:
    out = text
    for f in sorted(findings, key=lambda f: f["start"], reverse=True):
        out = out[: f["start"]] + f"[REDACTED_{f['type'].upper()}]" + out[f["end"] :]
    return out


# ---------------------------------------------------------------- models
class PiiRequest(BaseModel):
    text: str = Field(default="")


class EmbedRequest(BaseModel):
    text: str = Field(default="")


class ClassifyRequest(BaseModel):
    messages: list[Any] = Field(default_factory=list)


# ---------------------------------------------------------------- routes
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ml-service"}


@app.post("/pii/detect")
def pii_detect(req: PiiRequest) -> dict[str, Any]:
    findings = detect_pii(req.text or "")
    return {
        "findings": findings,
        "redacted_text": redact(req.text or "", findings),
        "warning": WARNING,
    }


def hashed_embedding(text: str, dim: int = 128) -> list[float]:
    vec: list[float] = []
    for i in range(dim):
        digest = hashlib.sha256(f"{text}#{i}".encode("utf-8")).digest()
        u = int.from_bytes(digest[:4], "big") / 0xFFFFFFFF  # [0, 1]
        vec.append(u * 2.0 - 1.0)  # [-1, 1]
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


@app.post("/embed")
def embed(req: EmbedRequest) -> dict[str, Any]:
    return {"embedding": hashed_embedding(req.text or ""), "dim": 128}


# Rule-based classifier -------------------------------------------------------
CODING_KW = (
    "code", "python", "javascript", "typescript", "function", "debug", "bug",
    "sql", "import ", "def ", "class ", "```", "compile", "refactor",
    "dockerfile", "fastapi",
)
REASONING_KW = (
    "why", "prove", "proof", "math", "logic", "reason", "solve",
    "step by step", "analyze", "analyse", "compare", "evaluate", "derive",
)
TOOL_KW = (
    "search the web", "browse", "use search", "function call", "call function",
    "run command", "execute", "tool", "calculator", "query the api",
)
STRUCTURED_KW = (
    "json", "schema", "table", "csv", "yaml", "format as", "return as",
    "markdown table", "as a list",
)


def _blob(messages: list[Any]) -> tuple[str, int]:
    parts: list[str] = []
    for m in messages:
        if isinstance(m, str):
            parts.append(m)
        elif isinstance(m, dict):
            c = m.get("content", "")
            parts.append(c if isinstance(c, str) else str(c))
        else:
            parts.append(str(m))
    blob = "\n".join(parts)
    return blob, len(blob)


def rule_classify(messages: list[Any]) -> tuple[str, str, float]:
    blob, total_chars = _blob(messages)
    low = blob.lower()
    n = len(messages)

    if total_chars > 6000 or n > 20:
        return "LONG_CONTEXT", "high", 0.85
    if any(k in low for k in TOOL_KW):
        return "TOOL_USE", "medium", 0.85
    if any(k in low for k in STRUCTURED_KW):
        return "STRUCTURED_OUTPUT", "medium", 0.8
    if any(k in low for k in CODING_KW):
        return "CODING", "medium", 0.8
    if any(k in low for k in REASONING_KW):
        return "REASONING", "high", 0.75
    if total_chars < 200:
        return "SIMPLE", "low", 0.55
    return "UNKNOWN", "low", 0.4


@app.post("/classify")
def classify(req: ClassifyRequest) -> dict[str, Any]:
    category, complexity, confidence = rule_classify(req.messages or [])
    return {"category": category, "complexity": complexity, "confidence": confidence}
