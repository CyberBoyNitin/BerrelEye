/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowClockwise, Check, Copy, Key, Plus, Trash } from "@phosphor-icons/react";
import { Spot } from "@/components/spot";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/ui/page-head";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/feedback";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ENDPOINTS, GatewayApiKey, KeysResponse, apiFetch, apiFetchFirst, isUnauthorized } from "@/lib/api";
import { errorMessage, formatDateTime } from "@/lib/format";

export default function KeysPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<GatewayApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [env, setEnv] = useState("live");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiFetchFirst<KeysResponse | GatewayApiKey[]>([...ENDPOINTS.keys]);
      setKeys(Array.isArray(data) ? data : (data.data ?? []));
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

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    setNewSecret(null);
    setCopied(false);
    try {
      const { data } = await apiFetchFirst<GatewayApiKey>([...ENDPOINTS.keys], {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), environment: env.trim() || "live" }),
      });
      if (data.key) setNewSecret(data.key);
      setName("");
      toast.success("Key created — copy the secret now, it shows only once.");
      await load();
    } catch (err) {
      const msg = errorMessage(err);
      setCreateError(msg);
      toast.error(`Key creation failed: ${msg}`);
    } finally {
      setCreating(false);
    }
  }

  async function onCopy() {
    if (!newSecret) return;
    try {
      await navigator.clipboard.writeText(newSecret);
      setCopied(true);
      toast.success("Secret copied to clipboard.");
    } catch {
      toast.error("Copy failed — select the secret manually.");
    }
  }

  async function onRevoke(id: string) {
    setRevoking(id);
    try {
      // Try revoke-style endpoints first, then DELETE.
      const candidates = [
        ...ENDPOINTS.keys.map((b) => `${b}/${encodeURIComponent(id)}/revoke`),
        ...ENDPOINTS.keys.map((b) => `${b}/${encodeURIComponent(id)}`),
      ];
      let ok = false;
      let lastErr: unknown = null;
      for (const c of candidates) {
        try {
          if (c.endsWith("/revoke")) {
            await apiFetch(c, { method: "POST", body: JSON.stringify({}) });
          } else {
            await apiFetch(c, { method: "DELETE" });
          }
          ok = true;
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!ok) throw lastErr instanceof Error ? lastErr : new Error("Revoke failed.");
      toast.success("Key revoked.");
      await load();
    } catch (err) {
      const msg = errorMessage(err);
      setCreateError(msg);
      toast.error(`Revoke failed: ${msg}`);
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Govern"
        icon={Key}
        title="API keys"
        description="Gateway keys for your traffic. Full secret shows once, at creation."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out">
            <ArrowClockwise size={14} aria-hidden />{loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />

      <Spot className="rounded-lg border border-line-1 bg-card shadow-card be-rise be-rise-1" aria-label="Create key">
        <header className="border-b border-line-1 p-5 pb-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink-1">
            <Plus size={15} aria-hidden /> Create key
          </h2>
          <p className="mt-1 text-xs text-ink-2">Name it, choose an environment, copy the secret once.</p>
        </header>
        <div className="p-5 pt-4">
          <form onSubmit={onCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <label htmlFor="key-name" className="text-xs font-medium text-ink-2">Name</label>
              <input id="key-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="prod-edge" className="flex h-9 w-full rounded-md border border-line-2 bg-raise px-3 py-1 text-sm text-ink-1 shadow-card transition-colors duration-150 ease-out placeholder:text-ink-3" />
            </div>
            <div className="w-full space-y-1 sm:w-40">
              <label htmlFor="key-env" className="text-xs font-medium text-ink-2">Environment</label>
              <input id="key-env" value={env} onChange={(e) => setEnv(e.target.value)} placeholder="live" className="flex h-9 w-full rounded-md border border-line-2 bg-raise px-3 py-1 font-mono text-xs text-ink-1 shadow-card transition-colors duration-150 ease-out placeholder:text-ink-3" />
            </div>
            <button type="submit" disabled={creating} className="inline-flex h-9 min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent px-4 text-sm font-medium text-accent-ink transition-[transform,background-color] duration-150 ease-out hover:bg-accent-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:min-h-0">
              <Plus size={15} aria-hidden />{creating ? "Creating…" : "Create key"}
            </button>
          </form>
          {createError ? <p className="mt-3 break-words rounded-md border border-line-2 bg-raise p-2 font-mono text-[11px] text-danger" role="alert">{createError}</p> : null}
          {newSecret ? (
            <div className="mt-3 rounded-lg border border-line-1 bg-accent-wash p-3" role="alert">
              <p className="text-xs font-semibold text-ink-1">Copy this secret now — it will never be shown again.</p>
              <code className="mt-2 block break-all rounded-md border border-line-1 bg-raise p-2 font-mono text-xs text-ink-1">{newSecret}</code>
              <button type="button" onClick={onCopy} className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-line-2 bg-card px-3 py-1.5 font-mono text-xs text-ink-1 transition-[transform,background-color] duration-150 ease-out hover:bg-hover active:scale-[0.98]">
                {copied ? <Check size={14} aria-hidden className="text-accent" /> : <Copy size={14} aria-hidden />}{copied ? "Copied" : "Copy secret"}
              </button>
            </div>
          ) : null}
        </div>
      </Spot>

      {loading ? <TableSkeleton rows={5} cols={5} /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && keys.length === 0 ? (
        <EmptyState title="No API keys yet" description="Create your first gateway key above. Use it as Authorization: Bearer <key> against /v1/chat/completions." />
      ) : null}

      {!loading && !error && keys.length > 0 ? (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Env</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => {
                  const revoked = !!k.revoked_at;
                  return (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.name}</TableCell>
                      <TableCell className="font-mono text-xs">{k.key_prefix}</TableCell>
                      <TableCell><span className="inline-flex items-center rounded-full border border-line-1 px-2 py-0.5 font-mono text-[11px] font-medium leading-4 text-ink-2">{k.environment}</span></TableCell>
                      <TableCell className="font-mono text-xs tnum">{formatDateTime(k.created_at)}</TableCell>
                      <TableCell className="font-mono text-xs tnum">{formatDateTime(k.last_used_at ?? null)}</TableCell>
                      <TableCell>{revoked ? <span className="inline-flex items-center rounded-full border border-line-1 px-2 py-0.5 font-mono text-[11px] font-medium leading-4 text-danger">revoked</span> : <span className="inline-flex items-center rounded-full border border-line-1 bg-accent-wash px-2 py-0.5 font-mono text-[11px] font-medium leading-4 text-accent">active</span>}</TableCell>
                      <TableCell className="text-right">
                        {!revoked ? (
                          <Button variant="outline" size="sm" disabled={revoking === k.id} onClick={() => onRevoke(k.id)} className="active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out">
                            <Trash size={14} aria-hidden />{revoking === k.id ? "Revoking…" : "Revoke"}
                          </Button>
                        ) : <span className="font-mono text-[11px] text-ink-3">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-2 md:hidden">
            {keys.map((k) => {
              const revoked = !!k.revoked_at;
              return (
                <article key={k.id} className="rounded-lg border border-line-1 bg-card p-3 shadow-card">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink-1">{k.name}</p>
                    {revoked
                      ? <span className="inline-flex items-center rounded-full border border-line-1 px-2 py-0.5 font-mono text-[11px] font-medium leading-4 text-danger">revoked</span>
                      : <span className="inline-flex items-center rounded-full border border-line-1 bg-accent-wash px-2 py-0.5 font-mono text-[11px] font-medium leading-4 text-accent">active</span>}
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-ink-3">{k.key_prefix} · {k.environment}</p>
                  <p className="mt-1 font-mono text-[11px] tnum text-ink-3">Created {formatDateTime(k.created_at)} · used {formatDateTime(k.last_used_at ?? null)}</p>
                  {!revoked ? (
                    <div className="mt-2 border-t border-line-1 pt-2">
                      <Button variant="outline" size="sm" disabled={revoking === k.id} onClick={() => onRevoke(k.id)} className="active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out">
                        <Trash size={14} aria-hidden />{revoking === k.id ? "Revoking…" : "Revoke"}
                      </Button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
