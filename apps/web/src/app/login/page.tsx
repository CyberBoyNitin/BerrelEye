"use client";

/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleNotch, EnvelopeSimple, LockKey, WarningCircle } from "@phosphor-icons/react";
import { isUnauthorized, login } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { AuthShell } from "@/components/auth-shell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Session cookie is set by the gateway (credentials:include inside login()).
      await login(email.trim(), password);
      router.push("/dashboard/overview");
    } catch (err) {
      setError(isUnauthorized(err) ? "Invalid email or password." : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Sign in"
      title="Sign in"
      description="Dashboard auth is a gateway session cookie."
      footer={
        <>
          No account? <Link href="/signup" className="font-medium text-ink-1 underline underline-offset-4">Create one</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
        <div className="space-y-1.5">
          <label htmlFor="email" className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-2">
            <EnvelopeSimple size={13} aria-hidden="true" /> Email
          </label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" aria-invalid={error ? true : undefined} aria-describedby={error ? "login-error" : undefined} className="h-11 w-full rounded-md border border-line-1 bg-raise px-3 py-1 text-sm text-ink-1 shadow-sm transition-colors placeholder:text-ink-3 hover:border-line-2 disabled:cursor-not-allowed disabled:opacity-50" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-2">
            <LockKey size={13} aria-hidden="true" /> Password
          </label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? "login-error" : undefined} className="h-11 w-full rounded-md border border-line-1 bg-raise px-3 py-1 text-sm text-ink-1 shadow-sm transition-colors placeholder:text-ink-3 hover:border-line-2 disabled:cursor-not-allowed disabled:opacity-50" />
        </div>
        {error ? (
          <p id="login-error" role="alert" className="flex items-start gap-2 rounded-md border border-line-1 bg-raise p-2.5 font-mono text-[11px] leading-5 text-danger">
            <WarningCircle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span className="break-words">{error}</span>
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink transition-[transform,background-color] hover:bg-accent-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60">
          {busy ? (
            <>
              <CircleNotch size={16} aria-hidden="true" className="animate-spin" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </AuthShell>
  );
}
