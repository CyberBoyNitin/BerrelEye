/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
import Link from "next/link";
import { BackToTop } from "@/components/back-to-top";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#proof", label: "How it works" },
      { href: "/#modes", label: "Routing modes" },
      { href: "/#estimate", label: "Cost estimator" },
      { href: "/dashboard/overview", label: "Dashboard" },
      { href: "/docs", label: "Docs" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/docs", label: "Quickstart" },
      { href: "/docs#auth", label: "Authentication" },
      { href: "/docs#chat", label: "Chat completions" },
      { href: "/docs#errors", label: "Errors" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/signup", label: "Create account" },
      { href: "/dashboard/keys", label: "API keys" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line-1 bg-paper">
      <div className="border-b border-line-1">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
              <span className="be-ping absolute inline-flex h-full w-full rounded-full bg-ink-1" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ink-1" />
            </span>
            OpenAI-compatible · Shadow by default
          </span>
          <span className="ml-auto font-mono text-[11px] text-ink-3">
            Secrets encrypted · Estimates labeled
          </span>
        </div>
      </div>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_repeat(3,1fr)]">
        <div>
          <Link href="/" className="flex min-h-[44px] items-center gap-2" aria-label="BerrelEye home">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent font-mono text-sm font-bold text-accent-ink">
              B
            </span>
            <span className="font-display text-sm font-semibold tracking-tight text-ink-1">
              BerrelEye
            </span>
          </Link>
          <p className="measure mt-2 max-w-xs text-[13px] leading-5 text-ink-2">
            An intelligent AI gateway that analyzes your traffic, finds cheaper model routes, and helps
            you reduce LLM infrastructure costs.
          </p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{col.title}</p>
            <ul className="mt-3 space-y-1 text-[13px]">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link
                    href={l.href}
                    className="inline-flex min-h-[32px] items-center text-ink-2 transition-colors hover:text-ink-1"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line-1">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="font-mono text-[11px] text-ink-3">© 2026 BerrelEye · AI cost gateway</p>
          <div className="flex items-center gap-4">
            <p className="font-mono text-[11px] text-ink-3">
              Example savings on this site are illustrative.
            </p>
            <BackToTop />
          </div>
        </div>
      </div>
    </footer>
  );
}
