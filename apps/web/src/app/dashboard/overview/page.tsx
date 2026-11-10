/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SpendBars, SplitBars } from "@/components/spend-chart";
import { Spot } from "@/components/spot";
import { Sparkline } from "@/components/sparkline";
import { ChartCard } from "@/components/ui/chart-card";
import { CountUp } from "@/components/ui/count-up";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { CardsSkeleton } from "@/components/ui/feedback";
import { SectionHead } from "@/components/ui/section-head";
import { Stat } from "@/components/ui/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ENDPOINTS,
  ModelStat,
  ModelsResponse,
  OverviewResponse,
  RequestRow,
  RequestsResponse,
  SecuritySummary,
  apiFetchFirst,
  isUnauthorized,
} from "@/lib/api";
import {
  errorMessage,
  formatDateTime,
  formatInt,
  formatMs,
  formatPct,
  formatUSD,
  formatUSD2,
  shortId,
} from "@/lib/format";

const TOP_MODELS_LIMIT = 5;
const RECENT_LIMIT = 5;

export default function OverviewPage() {
  const router = useRouter();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topModels, setTopModels] = useState<ModelStat[] | null>(null);
  const [recent, setRecent] = useState<RequestRow[] | null>(null);
  const [secSummary, setSecSummary] = useState<SecuritySummary | null>(null);
  const [secUnavailable, setSecUnavailable] = useState(false);

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

  // Supplemental sections below the fold reuse existing gateway endpoints
  // (models, requests, security summary) with the same fetch pattern. Each
  // degrades to an honest empty note — nothing is fabricated when an
  // endpoint is absent.
  useEffect(() => {
    if (!data || (data.requests ?? 0) === 0) return;
    let live = true;
    (async () => {
      try {
        const { data: m } = await apiFetchFirst<ModelsResponse | ModelStat[]>([...ENDPOINTS.models]);
        const rows = Array.isArray(m) ? m : (m.data ?? []);
        if (live) setTopModels([...rows].sort((a, b) => b.cost - a.cost).slice(0, TOP_MODELS_LIMIT));
      } catch {
        if (live) setTopModels([]);
      }
      try {
        const { data: r } = await apiFetchFirst<RequestsResponse | RequestRow[]>(
          [...ENDPOINTS.requests.map((p) => `${p}?limit=${RECENT_LIMIT}&offset=0`)],
        );
        if (live) setRecent(Array.isArray(r) ? r.slice(0, RECENT_LIMIT) : (r.data ?? []).slice(0, RECENT_LIMIT));
      } catch {
        if (live) setRecent([]);
      }
      try {
        const { data: s } = await apiFetchFirst<SecuritySummary>([...ENDPOINTS.securitySummary]);
        if (live) setSecSummary(s);
      } catch {
        if (live) setSecUnavailable(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div><h1 className="font-display text-lg font-semibold tracking-tight text-ink-1">Overview</h1><p className="text-[13px] text-ink-2">Loading live gateway data…</p></div>
        <CardsSkeleton count={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div><h1 className="font-display text-lg font-semibold tracking-tight text-ink-1">Overview</h1><p className="text-[13px] text-ink-2">Spend, savings, and traffic from the gateway.</p></div>
        <ErrorState message={error} onRetry={load} />
        <EmptyState title="No metrics to show yet" description="Send your first request through the gateway, then retry. See Docs → Quickstart for a working curl example." actionLabel="Read quickstart" actionHref="/docs" />
      </div>
    );
  }

  if (!data || (data.requests ?? 0) === 0) {
    return (
      <div className="space-y-4">
        <Hero data={data} />
        <EmptyState
          title="No requests recorded yet"
          description="Point your OpenAI-compatible client at the gateway and send a request. Overview metrics appear here from real usage rows — nothing is fabricated."
          actionLabel="Read quickstart"
          actionHref="/docs"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Hero data={data} />

      {/* 1 — Net spend + savings delta stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card be-rise be-rise-1">
          <Stat
            label="Net spend"
            value={<CountUp value={data.total_spend} format={formatUSD} />}
            caption={`${formatInt(data.requests)} requests · ${formatInt(data.tokens)} tokens`}
          />
        </Spot>
        <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card be-rise be-rise-1">
          <Stat
            label="Est. savings"
            value={<CountUp value={data.potential_savings} format={formatUSD2} />}
            caption={`Estimate — not money saved · ${formatPct(data.savings_pct)}`}
            accent
          >
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-ink-3">est.</span>
          </Stat>
        </Spot>
        <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card be-rise be-rise-1">
          <Stat
            label="Est. optimized spend"
            value={<CountUp value={data.estimated_optimized_spend} format={formatUSD} />}
            caption="What cheaper capable routes would cost"
          >
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-ink-3">est.</span>
          </Stat>
        </Spot>
        <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card be-rise be-rise-1">
          <Stat
            label="Cache hit rate"
            value={<CountUp value={data.cache_hit_rate} format={formatPct} />}
            caption={`${formatInt(data.cache_hits)} hits · ${formatInt(data.cache_misses)} misses`}
          />
        </Spot>
      </div>

      {/* 2 — Charts, each with an adjacent data-table alternative (no entrance motion on charts) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Spend by day"
          description="Measured provider cost per day · USD."
          alternative={
            data.spend_by_day && data.spend_by_day.length > 0 ? (
              <Table>
                <caption className="sr-only">Spend by day, same numbers as the chart</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Spend (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.spend_by_day.map((p) => (
                    <TableRow key={p.date}>
                      <TableCell className="font-mono text-xs text-ink-2">{p.date}</TableCell>
                      <TableCell className="text-right font-mono text-xs tnum">{formatUSD2(p.spend)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : undefined
          }
        >
          {data.spend_by_day && data.spend_by_day.length > 0 ? (
            <SpendBars points={data.spend_by_day} />
          ) : (
            <p className="text-[13px] text-ink-2">No daily breakdown returned by the gateway yet.</p>
          )}
        </ChartCard>

        <ChartCard
          title="Savings by source"
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
            <p className="text-[13px] text-ink-2">No savings breakdown returned by the gateway yet.</p>
          )}
        </ChartCard>
      </div>
      <p className="font-mono text-[11px] leading-4 text-ink-3">
        Actual savings and estimated savings are distinct. Projections are estimates, not money saved.
      </p>

      {/* 3 — Top models by cost (table: no entrance motion) */}
      <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card">
        <SectionHead
          eyebrow="Models"
          title="Top models by cost"
          description="Highest measured cost first, from live model analytics."
          action={
            <Link href="/dashboard/models" className="font-mono text-xs text-accent underline-offset-4 hover:underline">
              View all models →
            </Link>
          }
        />
        {topModels === null ? (
          <p className="mt-4 font-mono text-xs text-ink-3">Loading live model rows…</p>
        ) : topModels.length === 0 ? (
          <p className="mt-4 text-[13px] text-ink-2">No model analytics returned by the gateway yet.</p>
        ) : (
          <div className="mt-4">
            <Table>
              <caption className="sr-only">Top models by measured cost</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Cost (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topModels.map((m) => (
                  <TableRow key={`${m.provider ?? ""}:${m.model}`}>
                    <TableCell className="font-mono text-xs">
                      {m.model}
                      {m.provider ? <span className="text-ink-3"> · {m.provider}</span> : null}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tnum">{formatInt(m.requests)}</TableCell>
                    <TableCell className="text-right font-mono text-xs tnum">{formatUSD(m.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Spot>

      {/* 4 — Routing decisions feed */}
      <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card be-rise be-rise-2">
        <SectionHead
          eyebrow="Routing"
          title="Latest routing decisions"
          description="Requested → selected model with measured cost."
          action={
            <Link href="/dashboard/requests" className="font-mono text-xs text-accent underline-offset-4 hover:underline">
              View all requests →
            </Link>
          }
        />
        {recent === null ? (
          <p className="mt-4 font-mono text-xs text-ink-3">Loading live request rows…</p>
        ) : recent.length === 0 ? (
          <p className="mt-4 text-[13px] text-ink-2">No request rows returned by the gateway yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line-1">
            {recent.map((r, i) => (
              <li key={r.id || r.request_id} style={{ animationDelay: `${i * 60}ms` }} className="be-rise flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className="font-mono text-[11px] tabular-nums text-ink-3">{formatDateTime(r.created_at)}</span>
                <Link
                  href={`/dashboard/requests/${encodeURIComponent(r.request_id || r.id)}`}
                  className="font-mono text-xs text-accent underline-offset-2 hover:underline"
                >
                  {shortId(r.request_id || r.id)}
                </Link>
                <span className="font-mono text-xs text-ink-1">
                  {r.requested_model} → {r.selected_model || r.requested_model}
                </span>
                <span className="font-mono text-[11px] text-ink-3">{r.routing_mode || "—"}</span>
                <span className="ml-auto font-mono text-xs tabular-nums text-ink-1">{formatUSD(r.estimated_provider_cost)}</span>
              </li>
            ))}
          </ul>
        )}
      </Spot>

      {/* 5 — Cache / security strip */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card be-rise be-rise-3">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-3">Cache</p>
          <p className="mt-2 font-mono text-2xl tabular-nums tracking-tight text-ink-1">{formatPct(data.cache_hit_rate)}</p>
          <p className="mt-1 text-xs text-ink-2">
            {formatInt(data.cache_hits)} hits · {formatInt(data.cache_misses)} misses · avg {formatMs(data.avg_latency_ms)}
          </p>
          <Link href="/dashboard/cache" className="mt-3 inline-block font-mono text-xs text-accent underline-offset-4 hover:underline">
            Cache analytics →
          </Link>
        </Spot>
        <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card be-rise be-rise-3">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-3">Security</p>
          {secSummary ? (
            <>
              <p className="mt-2 font-mono text-2xl tabular-nums tracking-tight text-ink-1">{formatInt(secSummary.blocked_requests)}</p>
              <p className="mt-1 text-xs text-ink-2">
                blocked · {formatInt(secSummary.pii_detections)} PII · {formatInt(secSummary.secret_detections)} secrets · {formatInt(secSummary.rate_limit_events)} rate-limited
              </p>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-ink-2">
              {secUnavailable ? "Security summary unavailable on the gateway." : "Loading live security summary…"}
            </p>
          )}
          <Link href="/dashboard/security" className="mt-3 inline-block font-mono text-xs text-accent underline-offset-4 hover:underline">
            Security events →
          </Link>
        </Spot>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card">
          <Stat label="Tokens" value={formatInt(data.tokens)} caption="Input + output across requests" />
        </Spot>
        <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card">
          <Stat label="Average latency" value={formatMs(data.avg_latency_ms)} caption="Gateway-measured end to end" />
        </Spot>
        <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card">
          <Stat label="Provider success rate" value={formatPct(data.success_rate)} caption="Share of successful provider calls" />
        </Spot>
      </div>
    </div>
  );
}

function Hero({ data }: { data: OverviewResponse | null }) {
  const trend = data?.spend_by_day?.map((p) => p.spend) ?? [];
  return (
    <Spot className="rounded-lg border border-line-1 bg-card p-6 shadow-card be-rise" aria-label="Potential monthly savings">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-line-2 bg-accent-wash px-2 py-0.5 font-mono text-[11px] font-medium leading-4 text-accent">
              Potential monthly savings
            </span>
            <span className="font-mono text-[11px] text-ink-3">estimate — not money saved</span>
          </div>
          <p className="mt-2 font-mono text-4xl font-semibold tabular-nums tracking-tight text-accent">
            {data ? <CountUp value={data.potential_savings} format={formatUSD2} /> : "—"}
          </p>
          <p className="mt-1 text-[13px] text-ink-2">
            {data
              ? `Measured ${formatUSD2(data.total_spend)} vs. estimated optimized ${formatUSD2(data.estimated_optimized_spend)} (${formatPct(data.savings_pct)}).`
              : "Live number appears here once the gateway returns overview data."}
          </p>
          <Link href="/dashboard/requests" className="mt-4 inline-block font-mono text-xs text-ink-2 underline underline-offset-4 hover:text-ink-1">
            Inspect the requests behind this number →
          </Link>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex" aria-hidden={trend.length === 0}>
          <Sparkline points={trend} label="Daily spend trend" />
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
            {trend.length > 0 ? `${trend.length}d spend trend` : "trend appears with data"}
          </p>
        </div>
      </div>
    </Spot>
  );
}
