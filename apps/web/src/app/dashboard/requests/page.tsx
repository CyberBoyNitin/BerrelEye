/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowClockwise, ListBullets } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/ui/page-head";
import { Pill } from "@/components/ui/pill";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/feedback";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ENDPOINTS, RequestRow, RequestsResponse, apiFetchFirst, isUnauthorized } from "@/lib/api";
import { errorMessage, formatDateTime, formatInt, formatMs, formatUSD, shortId } from "@/lib/format";

const PAGE_SIZE = 50;

export default function RequestsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiFetchFirst<RequestsResponse | RequestRow[]>([...ENDPOINTS.requests.map((p) => `${p}?limit=${PAGE_SIZE}&offset=0`)]);
      if (Array.isArray(data)) {
        setRows(data);
        setTotal(data.length);
      } else {
        setRows(data.data ?? []);
        setTotal(data.total ?? data.data?.length ?? 0);
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

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Observe"
        icon={ListBullets}
        title="Requests"
        description="Per-request trace with cost, routing, and cache. Prompt content is hidden by default."
        meta={total !== null ? `${formatInt(total)} requests` : undefined}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out">
            <ArrowClockwise size={14} aria-hidden />{loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />

      {loading ? <TableSkeleton rows={8} cols={7} /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          title="No requests yet"
          description="Send an OpenAI-compatible request through the gateway (see Docs → Quickstart). Rows appear here with tokens, cost, latency, cache, routing, and status."
          actionLabel="Read quickstart"
          actionHref="/docs"
        />
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead>Cache</TableHead>
                  <TableHead>Routing</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.id || r.request_id} className="be-rise" style={{ animationDelay: `${Math.min(i, 14) * 30}ms` }}>
                    <TableCell className="font-mono text-xs tnum">{formatDateTime(r.created_at)}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/requests/${encodeURIComponent(r.request_id || r.id)}`} className="font-mono text-xs text-accent underline-offset-2 hover:underline">
                        {shortId(r.request_id || r.id)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs" title={`requested: ${r.requested_model}`}>{r.selected_model || r.requested_model}</TableCell>
                    <TableCell className="font-mono text-xs">{r.provider}</TableCell>
                    <TableCell className="text-right font-mono text-xs tnum">{formatInt(r.total_tokens)}</TableCell>
                    <TableCell className="text-right font-mono text-xs tnum">{formatUSD(r.estimated_provider_cost)}</TableCell>
                    <TableCell className="text-right font-mono text-xs tnum">{formatMs(r.latency_ms)}</TableCell>
                    <TableCell>{r.cache_hit ? <Pill tone="live">hit{r.cache_type ? ` · ${r.cache_type}` : ""}</Pill> : <Pill>miss</Pill>}</TableCell>
                    <TableCell><Pill>{r.routing_mode || "—"}</Pill></TableCell>
                    <TableCell>
                      <Pill tone={r.status === "success" || r.status === "completed" || r.status === "200" ? "live" : r.status === "cached" ? "info" : "alert"}>
                        {r.status}
                      </Pill>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-2 md:hidden">
            {rows.map((r, i) => (
              <article key={r.id || r.request_id} style={{ animationDelay: `${Math.min(i, 9) * 40}ms` }} className="be-rise rounded-lg border border-line-1 bg-card p-3 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/dashboard/requests/${encodeURIComponent(r.request_id || r.id)}`} className="font-mono text-xs text-accent underline-offset-2">
                    {shortId(r.request_id || r.id)}
                  </Link>
                  <Pill tone={r.status === "success" || r.status === "completed" || r.status === "200" ? "live" : r.status === "cached" ? "info" : "alert"}>
                    {r.status}
                  </Pill>
                </div>
                <p className="mt-1.5 break-all font-mono text-xs text-ink-1" title={`requested: ${r.requested_model}`}>{r.selected_model || r.requested_model}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line-1 pt-2">
                  <StackStat k="Tokens" v={formatInt(r.total_tokens)} />
                  <StackStat k="Cost" v={formatUSD(r.estimated_provider_cost)} />
                  <StackStat k="Latency" v={formatMs(r.latency_ms)} />
                  <StackStat k="At" v={formatDateTime(r.created_at)} />
                </dl>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.cache_hit ? <Pill tone="live">Cache hit{r.cache_type ? ` · ${r.cache_type}` : ""}</Pill> : <Pill>Cache miss</Pill>}
                  <Pill>{r.routing_mode || "—"}</Pill>
                  <span className="font-mono text-[11px] text-ink-3">{r.provider}</span>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}
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
