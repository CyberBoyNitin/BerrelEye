/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowClockwise, Database, Plus, Trash } from "@phosphor-icons/react";
import { Spot } from "@/components/spot";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/ui/page-head";
import { Pill } from "@/components/ui/pill";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/feedback";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ENDPOINTS, ProviderConfig, apiFetch, apiFetchFirst, isUnauthorized } from "@/lib/api";
import { errorMessage, formatInt, formatMs, formatPct, formatUSD } from "@/lib/format";

interface ProviderAnalyticsRow {
  provider: string;
  spend: number;
  requests: number;
  success_rate: number;
  avg_latency_ms: number;
  errors: number;
}

export default function ProvidersPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<ProviderConfig[]>([]);
  const [analytics, setAnalytics] = useState<ProviderAnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState("openai");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: cfg }, { data: ana }] = await Promise.all([
        apiFetchFirst<{ data: ProviderConfig[] }>([...ENDPOINTS.providers]),
        apiFetchFirst<{ data: ProviderAnalyticsRow[] }>([...ENDPOINTS.providerAnalytics]).catch(() => ({ data: { data: [] } as unknown as { data: ProviderAnalyticsRow[] } })),
      ]);
      setConfigs(cfg.data ?? []);
      const rows = (ana as unknown as { data: ProviderAnalyticsRow[] }).data ?? [];
      setAnalytics(rows);
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

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await apiFetchFirst([...ENDPOINTS.providers], {
        method: "POST",
        body: JSON.stringify({ provider, base_url: baseUrl, api_key: apiKey }),
      });
      setApiKey("");
      setBaseUrl("");
      setMsg("Provider saved. Secrets are encrypted at rest and never returned to the browser.");
      toast.success("Provider saved — secrets encrypted at rest.");
      await load();
    } catch (err) {
      const msg = `Save failed: ${errorMessage(err)}`;
      setMsg(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await apiFetch(`/api/providers/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast.success("Provider deleted.");
      await load();
    } catch (err) {
      const msg = `Delete failed: ${errorMessage(err)}`;
      setMsg(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Optimize"
        icon={Database}
        title="Providers"
        description="Credentials, health, spend and error rates. Raw keys never leave the server."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out">
            <ArrowClockwise size={14} aria-hidden />{loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />
      {loading ? <TableSkeleton rows={5} cols={5} /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}
      {!loading && !error ? (
        <div className="space-y-4">
          <Spot className="rounded-lg border border-line-1 bg-card shadow-card be-rise be-rise-1" aria-label="Add provider">
            <header className="border-b border-line-1 p-5 pb-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink-1">
                <Plus size={15} aria-hidden /> Add provider
              </h2>
              <p className="mt-1 text-xs text-ink-2">openai · anthropic · compat (OpenAI-compatible). Set base URL + key.</p>
            </header>
            <div className="p-5 pt-4">
              <form onSubmit={onSave} className="grid gap-3 sm:grid-cols-4">
                <Field id="pv" label="Provider">
                  <input id="pv" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="openai" className="flex h-9 w-full rounded-md border border-line-2 bg-raise px-3 py-1 font-mono text-xs text-ink-1 shadow-card transition-colors duration-150 ease-out placeholder:text-ink-3" />
                </Field>
                <Field id="bu" label="Base URL">
                  <input id="bu" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" className="flex h-9 w-full rounded-md border border-line-2 bg-raise px-3 py-1 font-mono text-xs text-ink-1 shadow-card transition-colors duration-150 ease-out placeholder:text-ink-3" />
                </Field>
                <Field id="ak" label="API key">
                  <input id="ak" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." className="flex h-9 w-full rounded-md border border-line-2 bg-raise px-3 py-1 font-mono text-xs text-ink-1 shadow-card transition-colors duration-150 ease-out placeholder:text-ink-3" />
                </Field>
                <div className="flex items-end">
                  <button type="submit" disabled={saving} className="inline-flex h-9 min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent px-4 text-sm font-medium text-accent-ink transition-[transform,background-color] duration-150 ease-out hover:bg-accent-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:min-h-0">
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
              {msg ? <p className="mt-3 font-mono text-[11px] text-ink-2" role="status">{msg}</p> : null}
            </div>
          </Spot>
          {configs.length === 0 ? (
            <EmptyState title="No providers configured" description="Add your first provider above. Until then the mock provider serves clearly-marked synthetic responses so the lifecycle stays exercisable." />
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Provider</TableHead><TableHead>Base URL</TableHead><TableHead>Hint</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Success</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {configs.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs font-medium">{c.provider}</TableCell>
                        <TableCell className="font-mono text-xs">{c.base_url || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{c.api_key_hint || "—"}</TableCell>
                        <TableCell>{c.dev_only ? <Pill tone="warn">dev_only</Pill> : <Pill tone="live">encrypted</Pill>} {c.enabled ? null : <Pill>disabled</Pill>}</TableCell>
                        <TableCell className="text-right font-mono text-xs tnum">{c.success_rate !== undefined && c.success_rate >= 0 ? formatPct(c.success_rate) : "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => onDelete(c.id)} className="active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out">
                            <Trash size={14} aria-hidden />Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-2 md:hidden">
                {configs.map((c) => (
                  <article key={c.id} className="rounded-lg border border-line-1 bg-card p-3 shadow-card">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-xs font-medium text-ink-1">{c.provider}</p>
                      <Button variant="outline" size="sm" onClick={() => onDelete(c.id)} className="active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out">
                        <Trash size={14} aria-hidden />Delete
                      </Button>
                    </div>
                    <p className="mt-1 break-all font-mono text-[11px] text-ink-2">{c.base_url || "—"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line-1 pt-2">
                      {c.dev_only ? <Pill tone="warn">dev_only</Pill> : <Pill tone="live">encrypted</Pill>}
                      {c.enabled ? null : <Pill>disabled</Pill>}
                      <span className="font-mono text-[11px] tnum text-ink-3">Success {c.success_rate !== undefined && c.success_rate >= 0 ? formatPct(c.success_rate) : "—"}</span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          {analytics.length > 0 ? (
            <Spot className="rounded-lg border border-line-1 bg-card shadow-card" aria-label="Provider analytics">
              <header className="border-b border-line-1 p-5 pb-3">
                <h2 className="text-sm font-semibold tracking-tight text-ink-1">Provider analytics</h2>
                <p className="mt-1 text-xs text-ink-2">Measured spend, success rate and latency from real requests.</p>
              </header>
              <div className="p-5 pt-3">
                <div className="hidden md:block">
                  <Table>
                    <TableHeader><TableRow><TableHead>Provider</TableHead><TableHead className="text-right">Spend</TableHead><TableHead className="text-right">Requests</TableHead><TableHead className="text-right">Success</TableHead><TableHead className="text-right">Latency</TableHead><TableHead className="text-right">Errors</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {analytics.map((a) => (
                        <TableRow key={a.provider}>
                          <TableCell className="font-mono text-xs">{a.provider}</TableCell>
                          <TableCell className="text-right font-mono text-xs tnum">{formatUSD(a.spend)}</TableCell>
                          <TableCell className="text-right font-mono text-xs tnum">{formatInt(a.requests)}</TableCell>
                          <TableCell className="text-right font-mono text-xs tnum">{formatPct(a.success_rate)}</TableCell>
                          <TableCell className="text-right font-mono text-xs tnum">{formatMs(a.avg_latency_ms)}</TableCell>
                          <TableCell className="text-right font-mono text-xs tnum">{formatInt(a.errors)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-2 md:hidden">
                  {analytics.map((a) => (
                    <article key={a.provider} className="rounded-md border border-line-1 bg-raise p-3">
                      <p className="font-mono text-xs text-ink-1">{a.provider}</p>
                      <dl className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1.5 border-t border-line-1 pt-2">
                        <StackStat k="Spend" v={formatUSD(a.spend)} />
                        <StackStat k="Requests" v={formatInt(a.requests)} />
                        <StackStat k="Success" v={formatPct(a.success_rate)} />
                        <StackStat k="Latency" v={formatMs(a.avg_latency_ms)} />
                        <StackStat k="Errors" v={formatInt(a.errors)} />
                      </dl>
                    </article>
                  ))}
                </div>
              </div>
            </Spot>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-ink-2">{label}</label>
      {children}
    </div>
  );
}

function StackStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] text-ink-3">{k}</dt>
      <dd className="font-mono text-xs tnum text-ink-1">{v}</dd>
    </div>
  );
}
