/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowClockwise, Plus, Users } from "@phosphor-icons/react";
import { Spot } from "@/components/spot";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/ui/page-head";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/feedback";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ENDPOINTS, MemberRow, apiFetchFirst, isUnauthorized } from "@/lib/api";
import { errorMessage } from "@/lib/format";

export default function MembersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiFetchFirst<{ data: MemberRow[] }>([...ENDPOINTS.members]);
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

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const invitedEmail = email;
    const invitedRole = role;
    try {
      await apiFetchFirst([...ENDPOINTS.members], { method: "POST", body: JSON.stringify({ email, role }) });
      setEmail("");
      setMsg(`Added ${invitedEmail} as ${invitedRole}.`);
      toast.success(`Member invited — ${invitedEmail} added as ${invitedRole}.`);
      await load();
    } catch (err) {
      const msg = `Invite failed: ${errorMessage(err)}`;
      setMsg(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Govern"
        icon={Users}
        title="Members"
        description="Organization membership. Users must sign up before they can be added."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out">
            <ArrowClockwise size={14} aria-hidden />{loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />
      {loading ? <TableSkeleton rows={4} cols={3} /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}
      {!loading && !error ? (
        <div className="space-y-4">
          <Spot className="rounded-lg border border-line-1 bg-card shadow-card be-rise be-rise-1" aria-label="Add member">
            <header className="border-b border-line-1 p-5 pb-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink-1">
                <Plus size={15} aria-hidden /> Add member
              </h2>
              <p className="mt-1 text-xs text-ink-2">admin · member</p>
            </header>
            <div className="p-5 pt-4">
              <form onSubmit={onInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <label htmlFor="em" className="text-xs font-medium text-ink-2">Email</label>
                  <input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" required className="flex h-9 w-full rounded-md border border-line-2 bg-raise px-3 py-1 text-sm text-ink-1 shadow-card transition-colors duration-150 ease-out placeholder:text-ink-3" />
                </div>
                <div className="w-full space-y-1 sm:w-40">
                  <label htmlFor="rl" className="text-xs font-medium text-ink-2">Role</label>
                  <input id="rl" value={role} onChange={(e) => setRole(e.target.value)} placeholder="member" className="flex h-9 w-full rounded-md border border-line-2 bg-raise px-3 py-1 font-mono text-xs text-ink-1 shadow-card transition-colors duration-150 ease-out placeholder:text-ink-3" />
                </div>
                <button type="submit" disabled={saving} className="inline-flex h-9 min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent px-4 text-sm font-medium text-accent-ink transition-[transform,background-color] duration-150 ease-out hover:bg-accent-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:min-h-0">
                  <Plus size={15} aria-hidden />{saving ? "Adding…" : "Add"}
                </button>
              </form>
              {msg ? <p className="mt-3 font-mono text-[11px] text-ink-2" role="status">{msg}</p> : null}
            </div>
          </Spot>
          {rows.length === 0 ? <EmptyState title="No members" description="Only you are here so far." /> : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>User ID</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {rows.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.email}</TableCell>
                        <TableCell><span className="inline-flex items-center rounded-full border border-line-1 px-2 py-0.5 font-mono text-[11px] font-medium leading-4 text-ink-2">{m.role}</span></TableCell>
                        <TableCell className="font-mono text-xs">{m.user_id}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-2 md:hidden">
                {rows.map((m) => (
                  <article key={m.id} className="rounded-lg border border-line-1 bg-card p-3 shadow-card">
                    <p className="text-sm font-medium text-ink-1">{m.email}</p>
                    <p className="mt-1 font-mono text-[11px] text-ink-2">{m.role}</p>
                    <p className="mt-0.5 break-all font-mono text-[11px] text-ink-3">{m.user_id}</p>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
