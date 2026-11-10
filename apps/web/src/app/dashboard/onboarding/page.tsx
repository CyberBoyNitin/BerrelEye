/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowClockwise, Check, Circle, Copy, Rocket } from "@phosphor-icons/react";
import { Spot } from "@/components/spot";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/ui/page-head";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/feedback";
import { ENDPOINTS, apiFetchFirst, isUnauthorized } from "@/lib/api";
import { errorMessage } from "@/lib/format";

interface OnboardingResp {
  endpoint: string;
  steps: string[];
  curl: string;
  shadow_mode_active: boolean;
  progress?: { has_provider: boolean; has_key: boolean; has_request: boolean };
}

export default function OnboardingPage() {
  const router = useRouter();
  const [data, setData] = useState<OnboardingResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiFetchFirst<OnboardingResp>([...ENDPOINTS.onboarding]);
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

  async function onCopyCurl() {
    if (!data?.curl) return;
    try {
      await navigator.clipboard.writeText(data.curl);
      toast.success("Curl copied to clipboard.");
    } catch {
      toast.error("Copy failed — select the command manually.");
    }
  }

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Setup"
        icon={Rocket}
        title="Onboarding"
        description="Ship cheaper LLM traffic in an afternoon. Shadow mode first — no behavior change."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out">
            <ArrowClockwise size={14} aria-hidden />{loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />
      {loading ? <Skeleton className="h-64 w-full" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && data ? (
        <div className="space-y-4">
          {data.shadow_mode_active ? (
            <p className="rounded-lg border border-line-1 bg-accent-wash p-3 text-xs font-semibold text-ink-1" role="status">
              Shadow mode active — analyzing without rerouting.
            </p>
          ) : null}
          <ol className="grid gap-3 be-rise be-rise-1">
            {["Create organization — done at signup", "Add provider — /dashboard/providers", "Create gateway API key — /dashboard/keys", "Copy endpoint — " + data.endpoint, "Send first request — see curl below"].map((s, i) => {
              const done = data.progress ? [true, data.progress.has_provider, data.progress.has_key, true, data.progress.has_request][i] : i === 0;
              return (
                <li key={s} className="flex items-start gap-3 rounded-lg border border-line-1 bg-card p-4 shadow-card">
                  <span aria-hidden className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${done ? "border-line-1 bg-accent-wash text-accent" : "border-line-1 bg-raise text-ink-3"}`}>
                    {done ? <Check size={14} /> : <Circle size={12} />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-1">Step {i + 1}</p>
                    <p className="mt-0.5 break-words font-mono text-xs text-ink-2">{s}</p>
                    <p className={`mt-1 font-mono text-[11px] ${done ? "text-accent" : "text-ink-3"}`}>{done ? "done" : "pending"}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <Spot className="rounded-lg border border-line-1 bg-card shadow-card be-rise be-rise-2" aria-label="Copy endpoint">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line-1 p-5 pb-3">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-ink-1">Copy endpoint</h2>
                <p className="mt-1 text-xs text-ink-2">OpenAI-compatible. Keep your SDK.</p>
              </div>
              <button type="button" onClick={onCopyCurl} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-line-2 bg-raise px-3 py-1.5 font-mono text-xs text-ink-1 transition-[transform,background-color] duration-150 ease-out hover:bg-hover active:scale-[0.98]">
                <Copy size={14} aria-hidden />Copy curl
              </button>
            </header>
            <div className="p-5 pt-4">
              <pre className="overflow-x-auto rounded-lg border border-line-1 bg-raise p-4 font-mono text-xs leading-5 tnum text-ink-1">{data.curl}</pre>
            </div>
          </Spot>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/requests" className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent px-4 text-sm font-medium text-accent-ink transition-[transform,background-color] duration-150 ease-out hover:bg-accent-strong active:scale-[0.98]">
              View requests
            </Link>
            <Link href="/docs" className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-md border border-line-2 bg-card px-4 text-sm font-medium text-ink-1 transition-[transform,background-color] duration-150 ease-out hover:bg-hover active:scale-[0.98]">
              Read docs
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
