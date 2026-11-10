/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowClockwise, Check, Gear } from "@phosphor-icons/react";
import { Spot } from "@/components/spot";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/ui/page-head";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/feedback";
import { ENDPOINTS, OrgSettings, apiFetchFirst, isUnauthorized } from "@/lib/api";
import { errorMessage } from "@/lib/format";

type Mode = "OFF" | "SHADOW" | "RECOMMEND" | "AUTO";

const MODES: Mode[] = ["OFF", "SHADOW", "RECOMMEND", "AUTO"];

const MODE_HELP: Record<Mode, string> = {
  OFF: "Use the requested model. Explicit customer choice is never overridden.",
  SHADOW: "Use the requested model but analyze cheaper alternatives. No behavior change.",
  RECOMMEND: "Use the requested model and surface the potential optimization.",
  AUTO: "Gateway may select an alternative. Every decision is explainable.",
};

const INPUT_CLS =
  "flex h-9 w-full rounded-md border border-line-2 bg-raise px-3 py-1 font-mono text-xs tnum text-ink-1 shadow-card transition-colors duration-150 ease-out placeholder:text-ink-3";

function weightError(v: string): string | null {
  if (!v.trim()) return "Enter a number between 0 and 1.";
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1) return "Enter a number between 0 and 1.";
  return null;
}

function positiveError(v: string, label: string): string | null {
  if (!v.trim()) return `Enter a positive ${label}.`;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return `Enter a positive ${label}.`;
  return null;
}

function optionalMoneyError(v: string): string | null {
  if (!v.trim()) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return "Enter 0 or more, or leave empty for no limit.";
  return null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Editable fields (initialized from gateway response; empty defaults when none).
  const [mode, setMode] = useState<Mode>("SHADOW");
  const [defaultModel, setDefaultModel] = useState("auto");
  const [qw, setQw] = useState("0.5");
  const [cw, setCw] = useState("0.35");
  const [lw, setLw] = useState("0.15");
  const [semantic, setSemantic] = useState(false);
  const [threshold, setThreshold] = useState("0.9");
  const [ttl, setTtl] = useState("3600");
  const [budgetBehavior, setBudgetBehavior] = useState("ALERT_ONLY");
  const [monthly, setMonthly] = useState("");
  const [daily, setDaily] = useState("");
  const [perReq, setPerReq] = useState("");
  const [rlOrg, setRlOrg] = useState("600");
  const [rlKey, setRlKey] = useState("300");
  const [rlIp, setRlIp] = useState("300");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiFetchFirst<OrgSettings>([...ENDPOINTS.settings]);
      setSettings(data);
      const rp = data.routing_policy;
      if (rp) {
        if (isMode(rp.optimization_mode)) setMode(rp.optimization_mode);
        setDefaultModel(rp.default_model || "auto");
        setQw(String(rp.quality_weight ?? 0.5));
        setCw(String(rp.cost_weight ?? 0.35));
        setLw(String(rp.latency_weight ?? 0.15));
        setSemantic(!!rp.semantic_cache_enabled);
        setThreshold(String(rp.semantic_threshold ?? 0.9));
        setTtl(String(rp.cache_ttl_seconds ?? 3600));
        setBudgetBehavior(rp.budget_behavior || "ALERT_ONLY");
        setRlOrg(String((rp as unknown as { rate_limit_org_per_min?: number }).rate_limit_org_per_min ?? 600));
        setRlKey(String((rp as unknown as { rate_limit_key_per_min?: number }).rate_limit_key_per_min ?? 300));
        setRlIp(String((rp as unknown as { rate_limit_ip_per_min?: number }).rate_limit_ip_per_min ?? 300));
      }
      if (data.budgets) {
        setMonthly(data.budgets.monthly_budget?.toString() ?? "");
        setDaily(data.budgets.daily_budget?.toString() ?? "");
        setPerReq(data.budgets.per_request_limit?.toString() ?? "");
      }
    } catch (err) {
      if (isUnauthorized(err)) {
        router.push("/login");
        return;
      }
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  function numOrNull(s: string): number | null {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  function validateAll(): Record<string, string> {
    const next: Record<string, string> = {};
    const wq = weightError(qw);
    if (wq) next.qw = wq;
    const wc = weightError(cw);
    if (wc) next.cw = wc;
    const wl = weightError(lw);
    if (wl) next.lw = wl;
    const th = weightError(threshold);
    if (th) next.threshold = th;
    const tt = positiveError(ttl, "TTL in seconds");
    if (tt) next.ttl = tt;
    const mo = optionalMoneyError(monthly);
    if (mo) next.monthly = mo;
    const da = optionalMoneyError(daily);
    if (da) next.daily = da;
    const pr = optionalMoneyError(perReq);
    if (pr) next.perReq = pr;
    const ro = positiveError(rlOrg, "org limit");
    if (ro) next.rlOrg = ro;
    const rk = positiveError(rlKey, "key limit");
    if (rk) next.rlKey = rk;
    const ri = positiveError(rlIp, "IP limit");
    if (ri) next.rlIp = ri;
    return next;
  }

  function touch(key: string, msg: string | null) {
    setErrors((prev) => {
      const next = { ...prev };
      if (msg) next[key] = msg;
      else delete next[key];
      return next;
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const found = validateAll();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setSaveMsg(null);
      toast.error("Fix the highlighted fields before saving.");
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const payload = {
        routing_policy: {
          optimization_mode: mode,
          default_model: defaultModel.trim() || "auto",
          quality_weight: Number(qw),
          cost_weight: Number(cw),
          latency_weight: Number(lw),
          semantic_cache_enabled: semantic,
          semantic_threshold: Number(threshold),
          cache_ttl_seconds: Number(ttl),
          budget_behavior: budgetBehavior,
          rate_limit_org_per_min: Number(rlOrg) || 600,
          rate_limit_key_per_min: Number(rlKey) || 300,
          rate_limit_ip_per_min: Number(rlIp) || 300,
        },
        budgets: {
          monthly_budget: numOrNull(monthly),
          daily_budget: numOrNull(daily),
          per_request_limit: numOrNull(perReq),
        },
      };
      const { data } = await apiFetchFirst<OrgSettings>([...ENDPOINTS.settings], {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setSettings(data ?? null);
      setSaveMsg("Saved. Policy is live for subsequent gateway requests.");
      toast.success("Settings saved — policy is live.");
    } catch (err) {
      const msg = `Save failed: ${errorMessage(err)}`;
      setSaveMsg(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Setup"
        icon={Gear}
        title="Settings"
        description={`${settings?.organization ? `${settings.organization.name} · ` : ""}Routing, caching, security posture, and budgets.`}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out">
            <ArrowClockwise size={14} aria-hidden />{loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>
      ) : null}
      {!loading && error ? (
        <>
          <ErrorState message={error} onRetry={load} />
          <EmptyState title="Settings unavailable" description="The gateway settings endpoint did not respond. The form below still shows local defaults — saving will retry the gateway." />
        </>
      ) : null}

      {!loading ? (
        <form onSubmit={onSave} noValidate className="space-y-4">
          <Spot className="rounded-lg border border-line-1 bg-card shadow-card" aria-label="Optimization mode">
            <header className="border-b border-line-1 p-5 pb-3">
              <h2 className="text-sm font-semibold tracking-tight text-ink-1">Optimization mode</h2>
              <p className="mt-1 text-xs text-ink-2">Explicit model choice is respected unless policy enables optimization.</p>
            </header>
            <div className="p-5 pt-4">
              <div className="grid gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Optimization mode">
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => setMode(m)}
                    className={`flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 py-2.5 text-left transition-[transform,background-color] duration-150 ease-out active:scale-[0.98] ${mode === m ? "border-line-2 bg-accent-wash text-ink-1" : "border-line-1 bg-raise text-ink-2 hover:bg-hover"}`}
                  >
                    {mode === m ? <Check size={14} aria-hidden className="shrink-0 text-accent" /> : null}
                    <span className="font-mono text-xs font-semibold">{m}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-2">{MODE_HELP[mode]}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="def-model" className="text-xs font-medium text-ink-2">Default model (UNKNOWN category)</label>
                  <input id="def-model" value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} placeholder="auto" className={INPUT_CLS} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="budget-behavior" className="text-xs font-medium text-ink-2">Budget behavior at 100%</label>
                  <input id="budget-behavior" value={budgetBehavior} onChange={(e) => setBudgetBehavior(e.target.value)} placeholder="ALERT_ONLY" className={INPUT_CLS} />
                  <p className="font-mono text-[10px] text-ink-3">BLOCK · DEGRADE_TO_CHEAPER_MODEL · ALERT_ONLY</p>
                </div>
              </div>
            </div>
          </Spot>

          <Spot className="rounded-lg border border-line-1 bg-card shadow-card" aria-label="Routing weights">
            <header className="border-b border-line-1 p-5 pb-3">
              <h2 className="text-sm font-semibold tracking-tight text-ink-1">Routing weights</h2>
              <p className="mt-1 text-xs text-ink-2">score = quality·qw − cost·cw − latency·lw. Configurable per organization.</p>
            </header>
            <div className="p-5 pt-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <NumField id="qw" label="Quality weight" value={qw} onChange={setQw} onBlur={() => touch("qw", weightError(qw))} error={errors.qw} />
                <NumField id="cw" label="Cost weight" value={cw} onChange={setCw} onBlur={() => touch("cw", weightError(cw))} error={errors.cw} />
                <NumField id="lw" label="Latency weight" value={lw} onChange={setLw} onBlur={() => touch("lw", weightError(lw))} error={errors.lw} />
              </div>
            </div>
          </Spot>

          <Spot className="rounded-lg border border-line-1 bg-card shadow-card" aria-label="Caching">
            <header className="border-b border-line-1 p-5 pb-3">
              <h2 className="text-sm font-semibold tracking-tight text-ink-1">Caching</h2>
              <p className="mt-1 text-xs text-ink-2">Exact cache preferred. Semantic cache is opt-in with a strict threshold.</p>
            </header>
            <div className="p-5 pt-4">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[13px] text-ink-1">
                <input type="checkbox" checked={semantic} onChange={(e) => setSemantic(e.target.checked)} className="h-4 w-4 accent-accent" />
                Enable semantic cache
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <NumField id="th" label="Semantic threshold" value={threshold} onChange={setThreshold} onBlur={() => touch("threshold", weightError(threshold))} error={errors.threshold} />
                <NumField id="ttl" label="Cache TTL (seconds)" value={ttl} onChange={setTtl} onBlur={() => touch("ttl", positiveError(ttl, "TTL in seconds"))} error={errors.ttl} numeric />
              </div>
            </div>
          </Spot>

          <Spot className="rounded-lg border border-line-1 bg-card shadow-card" aria-label="Budgets">
            <header className="border-b border-line-1 p-5 pb-3">
              <h2 className="text-sm font-semibold tracking-tight text-ink-1">Budgets</h2>
              <p className="mt-1 text-xs text-ink-2">Warnings at 80%, alerts at 90%, configured behavior at 100%. Empty = no limit.</p>
            </header>
            <div className="p-5 pt-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <NumField id="b-m" label="Monthly budget (USD)" value={monthly} onChange={setMonthly} onBlur={() => touch("monthly", optionalMoneyError(monthly))} error={errors.monthly} placeholder="10000" />
                <NumField id="b-d" label="Daily budget (USD)" value={daily} onChange={setDaily} onBlur={() => touch("daily", optionalMoneyError(daily))} error={errors.daily} placeholder="500" />
                <NumField id="b-r" label="Per-request limit (USD)" value={perReq} onChange={setPerReq} onBlur={() => touch("perReq", optionalMoneyError(perReq))} error={errors.perReq} placeholder="0.50" />
              </div>
            </div>
          </Spot>

          <Spot className="rounded-lg border border-line-1 bg-card shadow-card" aria-label="Rate limits">
            <header className="border-b border-line-1 p-5 pb-3">
              <h2 className="text-sm font-semibold tracking-tight text-ink-1">Rate limits</h2>
              <p className="mt-1 text-xs text-ink-2">Redis-backed per organization, API key and IP. 429 with Retry-After when exceeded.</p>
            </header>
            <div className="p-5 pt-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <NumField id="rl-o" label="Org per min" value={rlOrg} onChange={setRlOrg} onBlur={() => touch("rlOrg", positiveError(rlOrg, "org limit"))} error={errors.rlOrg} numeric />
                <NumField id="rl-k" label="Key per min" value={rlKey} onChange={setRlKey} onBlur={() => touch("rlKey", positiveError(rlKey, "key limit"))} error={errors.rlKey} numeric />
                <NumField id="rl-i" label="IP per min" value={rlIp} onChange={setRlIp} onBlur={() => touch("rlIp", positiveError(rlIp, "IP limit"))} error={errors.rlIp} numeric />
              </div>
            </div>
          </Spot>

          {saveMsg ? <p className="rounded-md border border-line-1 bg-raise p-2 font-mono text-[11px] text-ink-1" role="status">{saveMsg}</p> : null}
          <button type="submit" disabled={saving} className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent px-4 text-sm font-medium text-accent-ink transition-[transform,background-color] duration-150 ease-out hover:bg-accent-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50">
            <Check size={15} aria-hidden />{saving ? "Saving…" : "Save settings"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function NumField({ id, label, value, onChange, onBlur, error, placeholder, numeric }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error?: string;
  placeholder?: string;
  numeric?: boolean;
}) {
  const desc = `${id}-error`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-ink-2">{label}</label>
      <input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? desc : undefined}
        className={`${INPUT_CLS} ${error ? "border-danger" : ""} ${numeric ? "tnum" : ""}`}
      />
      {error ? <p id={desc} role="alert" className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

function isMode(v: string): v is Mode {
  return v === "OFF" || v === "SHADOW" || v === "RECOMMEND" || v === "AUTO";
}
