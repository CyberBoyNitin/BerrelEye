/* AuthShell — flagship split-screen auth. Left: inverted brand panel
 * (desktop only) with statement type + mono spec sheet. Right: focused
 * form column. Mobile collapses to the form with a compact brand row.
 */
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { API_BASE } from "@/lib/api";
import { WebGLBackground } from "@/components/webgl-background";

const SPECS: Array<[string, string]> = [
  ["Protocol", "OpenAI-compatible"],
  ["Default mode", "SHADOW · analyze only"],
  ["Browser keys", "never · session cookie"],
  ["Estimates", "always labeled"],
];

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel — fixed black in both themes, live WebGL underneath */}
      <div className="be-grain relative hidden overflow-hidden border-r border-line-1 bg-[#0A0A0A] text-[#FAFAFA] lg:flex lg:flex-col lg:justify-between lg:p-10">
        <WebGLBackground variant="ink" />
        <Link href="/" className="relative flex items-center gap-2" aria-label="BerrelEye home">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#FAFAFA] font-mono text-sm font-bold text-[#0A0A0A]">
            B
          </span>
          <span className="font-display text-sm font-semibold tracking-tight">BerrelEye</span>
        </Link>
        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-60">
            AI cost gateway
          </p>
          <p className="text-balance mt-4 max-w-md font-display text-5xl font-semibold leading-[0.98] tracking-tighter">
            Every request priced. Every saving proven.
          </p>
          <dl className="mt-10 max-w-sm border-t border-white/15 font-mono text-xs leading-6">
            {SPECS.map(([k, v]) => (
              <div
                key={k}
                className="flex items-baseline justify-between gap-4 border-b border-white/15 py-2.5 opacity-80"
              >
                <dt className="uppercase tracking-[0.14em] opacity-70">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="tnum relative font-mono text-[11px] opacity-60">Gateway: {API_BASE}</p>
      </div>

      {/* Form column */}
      <div className="relative flex items-center justify-center overflow-x-clip px-4 py-12">
        <div aria-hidden="true" className="be-grid-bg pointer-events-none absolute inset-0 lg:hidden" />
        <div className="be-rise relative w-full max-w-sm">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent font-mono text-sm font-bold text-accent-ink">
                B
              </span>
              <span className="text-sm font-semibold text-ink-1">BerrelEye</span>
            </Link>
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3 lg:inline">
              {eyebrow}
            </span>
            <Link
              href="/"
              aria-label="Back to home"
              className="inline-flex h-11 items-center gap-1.5 font-mono text-xs text-ink-3 transition-colors hover:text-ink-1"
            >
              <ArrowLeft size={14} aria-hidden="true" /> Back
            </Link>
          </div>
          <div className="rounded-xl border border-line-1 bg-card shadow-card">
            <div className="flex flex-col gap-1.5 p-5 pb-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">{eyebrow}</p>
              <h1 className="text-balance text-xl font-semibold leading-none tracking-tighter text-ink-1">
                {title}
              </h1>
              <p className="text-xs leading-5 text-ink-2">{description}</p>
            </div>
            <div className="p-5 pt-0">
              {children}
              <div className="mt-4 text-center text-xs leading-5 text-ink-2">{footer}</div>
              <p className="tnum mt-2 text-center font-mono text-[10px] text-ink-3">
                Gateway: {API_BASE}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
