/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowClockwise, ClockClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/ui/page-head";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/feedback";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ENDPOINTS, AuditRow, apiFetchFirst, isUnauthorized } from "@/lib/api";
import { errorMessage, formatDateTime, formatInt } from "@/lib/format";

export default function AuditPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiFetchFirst<{ data: AuditRow[] }>([...ENDPOINTS.audit]);
      setRows(data.data ?? []);
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
        eyebrow="Govern"
        icon={ClockClockwise}
        title="Audit logs"
        description="Logins, key changes, provider and policy updates. Secrets never stored."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out">
            <ArrowClockwise size={14} aria-hidden />{loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />
      {loading ? <TableSkeleton rows={6} cols={4} /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && rows.length === 0 ? <EmptyState title="No audit events" description="Actions like login, key creation and policy updates appear here." /> : null}
      {!loading && !error && rows.length > 0 ? (
        <div className="space-y-3">
          <div className="hidden md:block">
            <Table>
              <TableHeader><TableRow><TableHead>At</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Metadata</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs tnum">{formatDateTime(a.created_at)}</TableCell>
                    <TableCell className="text-xs">{a.actor}</TableCell>
                    <TableCell><span className="inline-flex items-center rounded-full border border-line-1 px-2 py-0.5 font-mono text-[11px] font-medium leading-4 text-ink-1">{a.action}</span></TableCell>
                    <TableCell className="max-w-[320px] truncate font-mono text-xs" title={a.metadata}>{a.metadata || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-2 md:hidden">
            {rows.map((a) => (
              <article key={a.id} className="rounded-lg border border-line-1 bg-card p-3 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-full border border-line-1 px-2 py-0.5 font-mono text-[11px] font-medium leading-4 text-ink-1">{a.action}</span>
                  <span className="font-mono text-[11px] tnum text-ink-3">{formatDateTime(a.created_at)}</span>
                </div>
                <p className="mt-1.5 text-xs text-ink-2">{a.actor}</p>
                <p className="mt-0.5 break-all font-mono text-[11px] text-ink-3">{a.metadata || "—"}</p>
              </article>
            ))}
          </div>
          <p className="font-mono text-[11px] tnum text-ink-3">{formatInt(rows.length)} events shown</p>
        </div>
      ) : null}
    </div>
  );
}
