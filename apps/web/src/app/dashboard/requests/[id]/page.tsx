/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { ArrowClockwise, ArrowLeft, CheckCircle } from "@phosphor-icons/react";
import { Spot } from "@/components/spot";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/ui/page-head";
import { Pill } from "@/components/ui/pill";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/feedback";
import { SectionHead } from "@/components/ui/section-head";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Timeline } from "@/components/ui/timeline";
import { ENDPOINTS, RequestDetailResponse, apiFetchFirst, isUnauthorized } from "@/lib/api";
import { errorMessage, formatDateTime, formatInt, formatMs, formatUSD } from "@/lib/format";

export default function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<RequestDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiFetchFirst<RequestDetailResponse>(ENDPOINTS.requestDetail(decodeURIComponent(id)));
      setDetail(data);
    } catch (err) {
      if (isUnauthorized(err)) {
        router.push("/login");
        return;
      }
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="be-rise min-w-0 space-y-2">
        <Link href="/dashboard/requests" className="inline-flex min-h-[32px] items-center gap-1 font-mono text-xs text-ink-3 transition-colors duration-150 ease-out hover:text-ink-1">
          <ArrowLeft size={13} aria-hidden /> Requests
        </Link>
        <PageHead
          eyebrow="Observe · request detail"
          title={decodeURIComponent(id)}
          description="Request metadata, routing decision, provider attempts, cost, and security events."
          actions={
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out">
              <ArrowClockwise size={14} aria-hidden />{loading ? "Loading…" : "Refresh"}
            </Button>
          }
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}
      {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}

      {!loading && !error && detail ? (
        <div className="space-y-4">
          <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card be-rise be-rise-1" aria-label="Routing timeline">
            <SectionHead
              eyebrow="Routing"
              title="Routing timeline"
              description="Policy → decision → attempts → cost, in order."
            />
            <div className="mt-4">
              <Timeline
                items={[
                  {
                    key: "policy",
                    title: `Policy · ${detail.request.routing_mode || "unknown mode"}`,
                    description: `Requested ${detail.request.requested_model || "—"} · category ${detail.routing_decision?.category || "—"}`,
                    tone: "default",
                  },
                  {
                    key: "decision",
                    title: `Decision · selected ${detail.routing_decision?.selected_model || detail.request.selected_model || "—"}`,
                    description:
                      detail.request.routing_reason && detail.request.routing_reason.length > 0
                        ? detail.request.routing_reason.join(" · ")
                        : detail.routing_decision
                          ? `Requested ${detail.routing_decision.requested_model} · recommended ${detail.routing_decision.recommended_model}`
                          : "No routing reasons recorded for this request.",
                    tone: "accent",
                  },
                  {
                    key: "attempts",
                    title: `Attempts · ${detail.provider_attempts?.length ?? 0} recorded`,
                    description:
                      detail.provider_attempts && detail.provider_attempts.length > 0
                        ? detail.provider_attempts.map((a) => `${a.provider}/${a.model} ${a.status}${a.latency_ms ? ` ${formatMs(a.latency_ms)}` : ""}`).join(" → ")
                        : "No provider attempts recorded.",
                    tone: "default",
                  },
                  {
                    key: "cost",
                    title: `Cost · ${formatUSD(detail.request.estimated_provider_cost)} actual`,
                    description:
                      detail.routing_decision
                        ? `Optimized estimate ${formatUSD(detail.routing_decision.estimated_optimized_cost)} · est. savings ${formatUSD(detail.routing_decision.estimated_savings)}`
                        : `${formatInt(detail.request.total_tokens)} total tokens · cache ${detail.request.cache_hit ? "hit" : "miss"}`,
                    tone: "accent",
                  },
                ]}
              />
            </div>
          </Spot>

          <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card be-rise be-rise-2" aria-label="Metadata">
            <SectionHead
              eyebrow="Trace"
              title="Metadata"
              description="Traceable usage — prompt content hidden by default."
            />
            <div className="mt-3">
              <dl className="grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
                <Meta k="Status" v={<Pill tone={detail.request.status?.includes("success") ? "live" : "alert"}>{detail.request.status}</Pill>} />
                <Meta k="Created" v={formatDateTime(detail.request.created_at)} mono />
                <Meta k="Requested model" v={detail.request.requested_model} mono />
                <Meta k="Selected model" v={detail.request.selected_model} mono />
                <Meta k="Provider" v={detail.request.provider} mono />
                <Meta k="Routing mode" v={detail.request.routing_mode} mono />
                <Meta k="Tokens" v={`${formatInt(detail.request.input_tokens)} in · ${formatInt(detail.request.output_tokens)} out · ${formatInt(detail.request.total_tokens)} total`} mono />
                <Meta k="Est. cost" v={formatUSD(detail.request.estimated_provider_cost)} mono />
                <Meta k="Latency" v={`${formatMs(detail.request.latency_ms)}${detail.request.time_to_first_token_ms ? ` · TTFT ${formatMs(detail.request.time_to_first_token_ms)}` : ""}`} mono />
                <Meta k="Cache" v={detail.request.cache_hit ? `hit${detail.request.cache_type ? ` · ${detail.request.cache_type}` : ""}` : "miss"} mono />
                {detail.request.error ? <Meta k="Error" v={detail.request.error} /> : null}
              </dl>
              {detail.request.routing_reason && detail.request.routing_reason.length > 0 ? (
                <div className="mt-4 rounded-md border border-line-1 bg-raise p-3">
                  <p className="text-xs font-semibold text-ink-1">Why this route?</p>
                  <ul className="mt-1 space-y-1 text-[13px] text-ink-2">
                    {detail.request.routing_reason.map((r, i) => <li key={i} className="flex gap-1.5"><CheckCircle size={14} aria-hidden className="mt-0.5 shrink-0 text-accent" />{r}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          </Spot>

          <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card be-rise be-rise-3" aria-label="Routing decision">
            <SectionHead
              eyebrow="Decision"
              title="Routing decision"
              description="Requested vs. recommended vs. selected, with savings math."
            />
            <div className="mt-3">
              {detail.routing_decision ? (
                <dl className="grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
                  <Meta k="Category" v={detail.routing_decision.category} mono />
                  <Meta k="Requested" v={detail.routing_decision.requested_model} mono />
                  <Meta k="Recommended" v={detail.routing_decision.recommended_model} mono />
                  <Meta k="Selected" v={detail.routing_decision.selected_model} mono />
                  <Meta k="Actual cost" v={formatUSD(detail.routing_decision.actual_cost)} mono />
                  <Meta k="Est. optimized" v={formatUSD(detail.routing_decision.estimated_optimized_cost)} mono />
                  <Meta k="Est. savings" v={formatUSD(detail.routing_decision.estimated_savings)} mono accent />
                </dl>
              ) : (
                <p className="text-[13px] text-ink-2">No routing decision recorded for this request.</p>
              )}
            </div>
          </Spot>

          <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card" aria-label="Provider attempts">
            <SectionHead
              eyebrow="Providers"
              title="Provider attempts"
              description="Retries and fallbacks, in order."
            />
            <div className="mt-3">
              {detail.provider_attempts && detail.provider_attempts.length > 0 ? (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader><TableRow><TableHead>Provider</TableHead><TableHead>Model</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Code</TableHead><TableHead className="text-right">Latency</TableHead><TableHead>Error</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {detail.provider_attempts.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="font-mono text-xs">{a.provider}</TableCell>
                            <TableCell className="font-mono text-xs">{a.model}</TableCell>
                            <TableCell><Pill tone={a.status === "success" ? "live" : "alert"}>{a.status}</Pill></TableCell>
                            <TableCell className="text-right font-mono text-xs tnum">{a.status_code || "—"}</TableCell>
                            <TableCell className="text-right font-mono text-xs tnum">{formatMs(a.latency_ms)}</TableCell>
                            <TableCell className="max-w-[240px] truncate text-xs text-ink-2" title={a.error}>{a.error || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="space-y-2 md:hidden">
                    {detail.provider_attempts.map((a, i) => (
                      <article key={a.id} className="rounded-md border border-line-1 bg-raise p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-xs text-ink-1">Attempt {i + 1} · {a.provider}</p>
                          <Pill tone={a.status === "success" ? "live" : "alert"}>{a.status}</Pill>
                        </div>
                        <p className="mt-1 break-all font-mono text-[11px] text-ink-2">{a.model}</p>
                        <p className="mt-1 font-mono text-[11px] tnum text-ink-3">Code {a.status_code || "—"} · {formatMs(a.latency_ms)}{a.error ? ` · ${a.error}` : ""}</p>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-ink-2">No provider attempts recorded.</p>
              )}
            </div>
          </Spot>

          <Spot className="rounded-lg border border-line-1 bg-card p-5 shadow-card" aria-label="Security events">
            <SectionHead
              eyebrow="Security"
              title="Security events"
              description="Counts and types — never raw secrets."
            />
            <div className="mt-3">
              {detail.security_events && detail.security_events.length > 0 ? (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Detail</TableHead><TableHead>At</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {detail.security_events.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell><Pill tone="warn">{s.type}</Pill></TableCell>
                            <TableCell className="whitespace-normal text-xs text-ink-2">{s.detail}</TableCell>
                            <TableCell className="font-mono text-xs tnum">{formatDateTime(s.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="space-y-2 md:hidden">
                    {detail.security_events.map((s) => (
                      <article key={s.id} className="rounded-md border border-line-1 bg-raise p-3">
                        <Pill tone="warn">{s.type}</Pill>
                        <p className="mt-1.5 text-xs leading-5 text-ink-2">{s.detail}</p>
                        <p className="mt-1 font-mono text-[11px] tnum text-ink-3">{formatDateTime(s.created_at)}</p>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-ink-2">No security events for this request.</p>
              )}
            </div>
          </Spot>
        </div>
      ) : null}
    </div>
  );
}

function Meta({ k, v, mono, accent }: { k: string; v: React.ReactNode; mono?: boolean; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line-1 py-1.5">
      <dt className="text-[11px] text-ink-3">{k}</dt>
      <dd className={`break-words text-[13px] ${mono ? "font-mono text-xs tnum" : ""} ${accent ? "text-accent" : "text-ink-1"}`}>{v}</dd>
    </div>
  );
}
