/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5
 * Live pipeline console: sends a REAL request through the gateway with the
 * documented local-test key and renders the REAL response. No mocks, no
 * invented data. Upstream is simulated by the gateway itself while provider
 * keys are empty (Testing Isolation Layer), and the UI says so.
 */
"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CircleNotch, PlugsConnected, Warning } from "@phosphor-icons/react";

const BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080";
const TEST_KEY = "sk-mock-client-enterprise-key-123";

type Resp = { status: number; ms: number; model: string; body: string };

export function LiveConsole() {
  const [models, setModels] = useState<string[]>([]);
  const [modelsFailed, setModelsFailed] = useState(false);
  const [model, setModel] = useState("gpt-4o-mini");
  const [message, setMessage] = useState("Hello through the gateway");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<Resp | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`${BASE}/v1/models`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (!live) return;
        const ids = (j?.data ?? []).map((m: { id: string }) => m.id).filter(Boolean);
        if (ids.length > 0) {
          setModels(ids);
          setModel((cur) => (ids.includes(cur) ? cur : ids.includes("gpt-4o-mini") ? "gpt-4o-mini" : ids[0]));
        }
      })
      .catch(() => live && setModelsFailed(true));
    return () => {
      live = false;
    };
  }, []);

  async function send() {
    setLoading(true);
    setError(null);
    const t0 = performance.now();
    try {
      const r = await fetch(`${BASE}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TEST_KEY}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: message }] }),
      });
      const text = await r.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* keep raw */
      }
      setResp({ status: r.status, ms: Math.round(performance.now() - t0), model, body: pretty });
    } catch {
      setError(
        `Gateway unreachable at ${BASE}. Start it with: STORE=memory SEED_DEMO=true go run ./cmd/server`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* controls */}
      <div className="rounded-xl border border-line-1 bg-card p-5 shadow-card sm:p-6">
        <label htmlFor="lc-model" className="font-mono text-[11px] uppercase tracking-widest text-ink-3">
          Model · live from /v1/models
        </label>
        <select
          id="lc-model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="mt-2 min-h-[44px] w-full rounded-md border border-line-1 bg-raise px-3 font-mono text-sm text-ink-1"
        >
          {(models.length > 0 ? models : ["gpt-4o-mini", "mock-medium"]).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {modelsFailed && (
          <p className="mt-2 font-mono text-[11px] text-ink-3">model list unreachable — typed fallback shown</p>
        )}
        <label htmlFor="lc-msg" className="mt-5 block font-mono text-[11px] uppercase tracking-widest text-ink-3">
          Message
        </label>
        <textarea
          id="lc-msg"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={500}
          className="mt-2 w-full resize-y rounded-md border border-line-1 bg-raise p-3 text-sm leading-6 text-ink-1 placeholder:text-ink-3"
          placeholder="What should the gateway price?"
        />
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={send}
            disabled={loading || message.trim().length === 0}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink transition-[transform,background-color,opacity] hover:bg-accent-strong active:scale-[0.98] disabled:opacity-40"
          >
            {loading ? (
              <>
                <CircleNotch size={16} className="animate-spin" aria-hidden="true" /> Sending
              </>
            ) : (
              <>
                Send through gateway <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
          <p className="font-mono text-[11px] leading-5 text-ink-3">
            local test key · upstream simulated while provider keys are empty
          </p>
        </div>
      </div>

      {/* readout */}
      <div className="overflow-hidden rounded-xl border border-line-1 bg-raise shadow-card">
        <div className="flex items-center gap-2 border-b border-line-1 px-4 py-2.5 font-mono text-xs text-ink-2">
          <PlugsConnected size={14} aria-hidden="true" />
          <span className="tnum">POST /v1/chat/completions</span>
          {resp && (
            <span className="tnum ml-auto text-ink-1">
              {resp.status} · {resp.ms}ms · {resp.model}
            </span>
          )}
        </div>
        {error ? (
          <div className="p-5">
            <p className="flex items-start gap-2 text-sm leading-6 text-ink-1" role="alert">
              <Warning size={16} className="mt-1 shrink-0" aria-hidden="true" /> {error}
            </p>
            <button
              type="button"
              onClick={send}
              className="mt-4 inline-flex min-h-[44px] items-center rounded-full border border-line-2 px-5 text-sm font-medium transition-[transform,background-color] hover:bg-hover active:scale-[0.98]"
            >
              Retry
            </button>
          </div>
        ) : resp ? (
          <pre className="be-fade-in max-h-[380px] overflow-auto p-4 font-mono text-xs leading-6 text-ink-1 tnum">
            {resp.body}
          </pre>
        ) : (
          <div className="flex min-h-[220px] items-center justify-center border border-dashed border-line-2 m-4 rounded-lg p-6">
            <p className="text-center font-mono text-xs leading-6 text-ink-3">
              Response lands here — status, latency,
              <br />
              and the gateway&apos;s real JSON.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
