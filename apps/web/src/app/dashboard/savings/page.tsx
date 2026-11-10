/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SplitBars } from "@/components/spend-chart";
import { Spot } from "@/components/spot";
import { ChartCard } from "@/components/ui/chart-card";
import { CountUp } from "@/components/ui/count-up";
import { ErrorState } from "@/components/ui/empty-state";
import { CardsSkeleton } from "@/components/ui/feedback";
import { Stat } from "@/components/ui/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ENDPOINTS, OverviewResponse, apiFetchFirst, isUnauthorized } from "@/lib/api";
import { errorMessage, formatPct, formatUSD, formatUSD2 } from "@/lib/format";
import { PiggyBank } from "@phosphor-icons/react";
import { PageHead } from "@/components/ui/page-head";

export default function SavingsPage() {
  const router = useRouter();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiFetchFirst<OverviewResponse>([...ENDPOINTS.overview]);
      setData(data);
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
    <div className="space-y-4">
      <PageHead
        eyebrow="Observe"
        icon={PiggyBank}
        title="Savings"
        description="Actual vs. estimated — estimates are never presented as money saved."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</Button>
        }
      />
      {loading ? <CardsSkeleton count={3} /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && data ? (
        <>
          <Spot className="rounded-lg border border-line-1 bg-card p-6 shadow-card be-rise be-rise-1" aria-label="Potential monthly savings estimate">
            <p className="font-mono text-[11px] uppercase tracking-wide text-ink-3">Potential monthly savings (estimate)</p>
            <p className="mt-1 font-mono text-4xl font-semibold tabular-nums tracking-tight text-accent">
              <CountUp value={data.potential_savings} format={formatUSD2} />
            </p>
            <p className="mt-1 text-[13px] text-ink-2">Measured {formatUSD2(data.total_spend)} vs. estimated optimized {formatUSD2(data.estimated_optimized_spend)} ({formatPct(data.savings_pct)}).</p>
          </Spot>
          <div className="grid gap-4 sm:grid-cols-3">
            <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card be-rise be-rise-2">
              <Stat
                label="Current spend"
                value={<CountUp value={data.total_spend} format={formatUSD} />}
                caption="Measured provider cost"
              />
            </Spot>
            <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card be-rise be-rise-2">
              <Stat
                label="Optimized spend (est.)"
                value={<CountUp value={data.estimated_optimized_spend} format={formatUSD} />}
                caption="Cheaper capable routes would cost"
              >
                <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-ink-3">est.</span>
              </Stat>
            </Spot>
            <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card be-rise be-rise-2">
              <Stat
                label="Actual saved (cache)"
                value={<CountUp value={data.estimated_actual_savings ?? 0} format={formatUSD} />}
                caption="Measured, not projected"
              />
            </Spot>
          </div>
          <ChartCard
            title="By source"
            description="Routing · caching · provider · model selection · USD, estimates."
            alternative={
              data.savings_by_source && data.savings_by_source.length > 0 ? (
                <Table>
                  <caption className="sr-only">Savings by source, same numbers as the chart</caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Saved (USD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.savings_by_source.map((r) => (
                      <TableRow key={r.source}>
                        <TableCell className="font-mono text-xs uppercase tracking-wide text-ink-2">{r.source}</TableCell>
                        <TableCell className="text-right font-mono text-xs tnum">{formatUSD2(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : undefined
            }
          >
            {data.savings_by_source && data.savings_by_source.length > 0 ? (
              <SplitBars rows={data.savings_by_source} />
            ) : (
              <p className="text-[13px] text-ink-2">No breakdown yet — send traffic in SHADOW mode first.</p>
            )}
          </ChartCard>
          <Spot className="rounded-lg border border-line-1 bg-raise p-5 be-rise be-rise-3" aria-label="Savings methodology">
            <h2 className="text-sm font-semibold tracking-tight text-ink-1">Methodology</h2>
            <p className="measure mt-1 text-[13px] leading-5 text-ink-2">
              Savings is the measured spend minus the estimated cost of cheaper capable routes for the same
              requests. Only cache hits count as actual saved money; routing, provider, and model-selection
              figures are projections — estimates, not money saved.
            </p>
          </Spot>
        </>
      ) : null}
    </div>
  );
}
