/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowClockwise, Cpu } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/ui/page-head";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/feedback";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ENDPOINTS, ModelStat, ModelsResponse, apiFetchFirst, isUnauthorized } from "@/lib/api";
import { errorMessage, formatInt, formatMs, formatPct, formatUSD } from "@/lib/format";

export default function ModelsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ModelStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiFetchFirst<ModelsResponse | ModelStat[]>([...ENDPOINTS.models]);
      setRows(Array.isArray(data) ? data : (data.data ?? []));
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

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Optimize"
        icon={Cpu}
        title="Models"
        description="Per-model usage with current vs. recommended cost comparison."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out">
            <ArrowClockwise size={14} aria-hidden />{loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />

      {loading ? <TableSkeleton rows={6} cols={7} /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          title="No model analytics yet"
          description="Model rows appear once the gateway records requests. Prices come from the model registry — nothing here is hard-coded."
          actionLabel="View requests"
          actionHref="/dashboard/requests"
        />
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Avg latency</TableHead>
                  <TableHead className="text-right">Error rate</TableHead>
                  <TableHead>Recommended</TableHead>
                  <TableHead className="text-right">Potential Δ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m, i) => (
                  <TableRow key={`${m.provider ?? ""}:${m.model}`} className="be-rise" style={{ animationDelay: `${Math.min(i, 14) * 30}ms` }}>
                    <TableCell className="font-mono text-xs font-medium">{m.model}</TableCell>
                    <TableCell className="font-mono text-xs">{m.provider ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs tnum">{formatInt(m.requests)}</TableCell>
                    <TableCell className="text-right font-mono text-xs tnum">{formatInt(m.tokens)}</TableCell>
                    <TableCell className="text-right font-mono text-xs tnum">{formatUSD(m.cost)}</TableCell>
                    <TableCell className="text-right font-mono text-xs tnum">{formatMs(m.avg_latency_ms)}</TableCell>
                    <TableCell className="text-right font-mono text-xs tnum">{formatPct(m.error_rate)}</TableCell>
                    <TableCell>
                      {m.recommended_model ? <span className="inline-flex items-center rounded-full border border-line-1 bg-accent-wash px-2 py-0.5 font-mono text-[11px] font-medium leading-4 text-accent">{m.recommended_model}</span> : <span className="text-xs text-ink-3">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tnum text-accent">
                      {m.potential_cost_difference !== undefined && m.potential_cost_difference !== null ? formatUSD(m.potential_cost_difference) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-2 md:hidden">
            {rows.map((m, i) => (
              <article key={`${m.provider ?? ""}:${m.model}`} style={{ animationDelay: `${Math.min(i, 9) * 40}ms` }} className="be-rise rounded-lg border border-line-1 bg-card p-3 shadow-card">
                <p className="break-all font-mono text-xs font-medium text-ink-1">{m.model}</p>
                <p className="mt-0.5 font-mono text-[11px] text-ink-3">{m.provider ?? "—"}</p>
                <dl className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1.5 border-t border-line-1 pt-2">
                  <StackStat k="Requests" v={formatInt(m.requests)} />
                  <StackStat k="Tokens" v={formatInt(m.tokens)} />
                  <StackStat k="Cost" v={formatUSD(m.cost)} />
                  <StackStat k="Avg latency" v={formatMs(m.avg_latency_ms)} />
                  <StackStat k="Error rate" v={formatPct(m.error_rate)} />
                  <StackStat k="Potential Δ" v={m.potential_cost_difference !== undefined && m.potential_cost_difference !== null ? formatUSD(m.potential_cost_difference) : "—"} accent />
                </dl>
                {m.recommended_model ? (
                  <p className="mt-2 font-mono text-[11px] text-accent">Recommended · {m.recommended_model}</p>
                ) : null}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function StackStat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] text-ink-3">{k}</dt>
      <dd className={`font-mono text-xs tnum ${accent ? "text-accent" : "text-ink-1"}`}>{v}</dd>
    </div>
  );
}
