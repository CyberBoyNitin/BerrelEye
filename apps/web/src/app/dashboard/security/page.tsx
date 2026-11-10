/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowClockwise, ShieldCheck } from "@phosphor-icons/react";
import { Spot } from "@/components/spot";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/ui/page-head";
import { Pill } from "@/components/ui/pill";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { CardsSkeleton, TableSkeleton } from "@/components/ui/feedback";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ENDPOINTS, SecurityEvent, SecurityEventsResponse, SecuritySummary, apiFetch, apiFetchFirst, isUnauthorized } from "@/lib/api";
import { errorMessage, formatDateTime, formatInt } from "@/lib/format";

export default function SecurityPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, e] = await Promise.all([
        apiFetchFirst<SecuritySummary>([...ENDPOINTS.securitySummary]).catch(() => null),
        apiFetchFirst<SecurityEventsResponse | SecurityEvent[]>([...ENDPOINTS.securityEvents.map((p) => `${p}?limit=50`)]).catch(() => null),
      ]);
      if (!s && !e) {
        // Fall back to a single events call without query string.
        const single = await apiFetch<SecurityEventsResponse | SecurityEvent[]>(ENDPOINTS.securityEvents[0]).catch(() => null);
        if (!single) throw new Error("Security endpoints unavailable on the gateway.");
      }
      if (s) setSummary(s.data);
      if (e) {
        const d = e.data;
        if (Array.isArray(d)) {
          setEvents(d);
          setTotal(d.length);
        } else if (d) {
          setEvents(d.data ?? []);
          setTotal(d.total ?? d.data?.length ?? 0);
        }
      } else {
        // Derive counts from events when no summary endpoint exists.
        setSummary(countFromEvents(events));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Govern"
        icon={ShieldCheck}
        title="Security"
        description="Detections and policy events — counts, never raw secrets."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out">
            <ArrowClockwise size={14} aria-hidden />{loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton count={4} />
          <TableSkeleton rows={6} cols={4} />
        </>
      ) : null}
      {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}

      {!loading && !error ? (
        <div className="space-y-4">
          {summary ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <CountCard label="PII detections" value={summary.pii_detections} hint="requests contained detected PII" />
              <CountCard label="Secret detections" value={summary.secret_detections} hint="token-shaped patterns" />
              <CountCard label="Blocked" value={summary.blocked_requests} hint="policy rejections" />
              <CountCard label="Rate-limited" value={summary.rate_limit_events} hint="429 / quota events" />
              <CountCard label="Policy violations" value={summary.policy_violations} hint="budget + routing rules" />
            </div>
          ) : null}

          {events.length === 0 ? (
            <EmptyState
              title="No security events"
              description="PII_DETECTED, SECRET_DETECTED, REQUEST_BLOCKED, RATE_LIMITED, INVALID_API_KEY, SUSPICIOUS_REQUEST and POLICY_VIOLATION events appear here with metadata only."
            />
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Request</TableHead>
                      <TableHead>Detail</TableHead>
                      <TableHead>At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell><Pill tone={toneFor(ev.type)}>{ev.type}</Pill></TableCell>
                        <TableCell className="font-mono text-xs">{ev.request_id || "—"}</TableCell>
                        <TableCell className="max-w-[420px] whitespace-normal text-xs text-ink-2">{ev.detail}</TableCell>
                        <TableCell className="font-mono text-xs tnum">{formatDateTime(ev.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-2 md:hidden">
                {events.map((ev) => (
                  <article key={ev.id} className="rounded-lg border border-line-1 bg-card p-3 shadow-card">
                    <div className="flex items-center justify-between gap-2">
                      <Pill tone={toneFor(ev.type)}>{ev.type}</Pill>
                      <span className="font-mono text-[11px] tnum text-ink-3">{formatDateTime(ev.created_at)}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-ink-2">{ev.detail}</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-ink-3">{ev.request_id || "—"}</p>
                  </article>
                ))}
              </div>
            </>
          )}
          {total !== null && events.length > 0 ? (
            <p className="font-mono text-[11px] tnum text-ink-3">{formatInt(total)} events · showing {events.length}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CountCard({ label, value, hint }: { label: string; value: number | null | undefined; hint: string }) {
  return (
    <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card be-rise be-rise-1" aria-label={label}>
      <h2 className="text-xs font-medium text-ink-2">{label}</h2>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight tnum text-ink-1">{formatInt(value ?? 0)}</p>
      <p className="mt-1 text-xs text-ink-3">{hint}</p>
    </Spot>
  );
}

function toneFor(t: string): "alert" | "warn" | "info" | "plain" {
  const u = t.toUpperCase();
  if (u.includes("BLOCK") || u.includes("INVALID")) return "alert";
  if (u.includes("PII") || u.includes("SECRET") || u.includes("SUSPICIOUS")) return "warn";
  if (u.includes("RATE")) return "info";
  return "plain";
}

function countFromEvents(events: SecurityEvent[]): SecuritySummary {
  const has = (sub: string) => events.filter((e) => e.type.toUpperCase().includes(sub)).length;
  return {
    pii_detections: has("PII"),
    secret_detections: has("SECRET"),
    blocked_requests: has("BLOCK"),
    rate_limit_events: has("RATE"),
    policy_violations: has("POLICY"),
  };
}
