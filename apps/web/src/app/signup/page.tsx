"use client";

/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BuildingOffice, CircleNotch, EnvelopeSimple, LockKey, WarningCircle } from "@phosphor-icons/react";
import { signup } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { AuthShell } from "@/components/auth-shell";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signup(email.trim(), password, orgName.trim() || email.trim());
      router.push("/dashboard/overview");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Get started"
      title="Create your account"
      description="Organization + login in one step. Then create a gateway API key."
      footer={
        <>
          Have an account? <Link href="/login" className="font-medium text-ink-1 underline underline-offset-4">Sign in</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="org" className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-2">
            <BuildingOffice size={13} aria-hidden="true" /> Organization name
          </label>
          <input id="org" required value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Inc" aria-invalid={error ? true : undefined} aria-describedby={error ? "signup-error" : undefined} className="h-11 w-full rounded-md border border-line-1 bg-raise px-3 py-1 text-sm text-ink-1 shadow-sm transition-colors placeholder:text-ink-3 hover:border-line-2 disabled:cursor-not-allowed disabled:opacity-50" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-2">
            <EnvelopeSimple size={13} aria-hidden="true" /> Email
          </label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" aria-invalid={error ? true : undefined} aria-describedby={error ? "signup-error" : undefined} className="h-11 w-full rounded-md border border-line-1 bg-raise px-3 py-1 text-sm text-ink-1 shadow-sm transition-colors placeholder:text-ink-3 hover:border-line-2 disabled:cursor-not-allowed disabled:opacity-50" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-2">
            <LockKey size={13} aria-hidden="true" /> Password
          </label>
          <input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" aria-invalid={error ? true : undefined} aria-describedby={error ? "signup-error" : undefined} className="h-11 w-full rounded-md border border-line-1 bg-raise px-3 py-1 text-sm text-ink-1 shadow-sm transition-colors placeholder:text-ink-3 hover:border-line-2 disabled:cursor-not-allowed disabled:opacity-50" />
        </div>
        {error ? (
          <p id="signup-error" role="alert" className="flex items-start gap-2 rounded-md border border-line-1 bg-raise p-2.5 font-mono text-[11px] leading-5 text-danger">
            <WarningCircle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span className="break-words">{error}</span>
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink transition-[transform,background-color] hover:bg-accent-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60">
          {busy ? (
            <>
              <CircleNotch size={16} aria-hidden="true" className="animate-spin" /> Creating…
            </>
          ) : (
            "Analyze My AI Spend"
          )}
        </button>
      </form>
    </AuthShell>
  );
}
