/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowClockwise, Lightning } from "@phosphor-icons/react";
import { Spot } from "@/components/spot";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/ui/page-head";
import { ErrorState } from "@/components/ui/empty-state";
import { CardsSkeleton } from "@/components/ui/feedback";
import { ENDPOINTS, apiFetchFirst, isUnauthorized } from "@/lib/api";
import { errorMessage, formatInt, formatPct } from "@/lib/format";

interface CacheStats {
  requests: number;
  hits: number;
  misses: number;
  hit_rate: number;
  note?: string;
}

export default function CachePage() {
  const router = useRouter();
  const [data, setData] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiFetchFirst<CacheStats>([...ENDPOINTS.cacheAnalytics]);
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
    <div className="space-y-5">
      <PageHead
        eyebrow="Optimize"
        icon={Lightning}
        title="Cache"
        description="Exact cache first, semantic opt-in. Bypass with X-AI-Cache: no-store."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out">
            <ArrowClockwise size={14} aria-hidden />{loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />
      {loading ? <CardsSkeleton count={3} /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && data ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card be-rise be-rise-1" aria-label="Cache requests">
              <h2 className="text-xs font-medium text-ink-2">Requests</h2>
              <p className="mt-2 font-mono text-2xl font-semibold tracking-tight tnum text-ink-1">{formatInt(data.requests)}</p>
              <p className="mt-1 font-mono text-[11px] tnum text-ink-3">{formatInt(data.hits)} hits · {formatInt(data.misses)} misses</p>
            </Spot>
            <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card be-rise be-rise-2" aria-label="Cache hit rate">
              <h2 className="text-xs font-medium text-ink-2">Hit rate</h2>
              <p className="mt-2 font-mono text-2xl font-semibold tracking-tight tnum text-accent">{formatPct(data.hit_rate)}</p>
              <p className="mt-1 font-mono text-[11px] tnum text-ink-3">{formatInt(data.hits)} hits · {formatInt(data.misses)} misses</p>
            </Spot>
            <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card be-rise be-rise-3" aria-label="Cache safety">
              <h2 className="text-xs font-medium text-ink-2">Safety</h2>
              <p className="mt-2 text-[13px] leading-5 text-ink-2 measure">Tool calls, transactions and no-store requests are never cached. Semantic requires opt-in + threshold.</p>
            </Spot>
          </div>
          {data.note ? <p className="font-mono text-[11px] text-ink-3">{data.note}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
