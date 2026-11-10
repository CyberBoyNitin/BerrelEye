/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
import type { Metadata } from "next";
import Link from "next/link";
import { CommandMenuTrigger } from "@/components/command-menu";
import { DashboardNav } from "@/components/dashboard-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper font-display text-ink-1">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line-1 bg-overlay/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex min-h-[44px] items-center gap-2" aria-label="BerrelEye home">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent font-mono text-sm font-bold text-accent-ink">
              B
            </span>
            <span className="text-sm font-semibold tracking-tight">BerrelEye</span>
            <span className="rounded-full border border-line-1 bg-raise px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-3">
              Dashboard
            </span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <CommandMenuTrigger />
            <ThemeToggle />
            <Link
              href="/docs"
              className="hidden min-h-[44px] items-center rounded-md px-3 text-[13px] text-ink-2 transition-[transform,background-color,color] hover:bg-hover hover:text-ink-1 active:scale-[0.98] sm:inline-flex"
            >
              Docs
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center rounded-md px-3 text-[13px] text-ink-2 transition-[transform,background-color,color] hover:bg-hover hover:text-ink-1 active:scale-[0.98]"
            >
              Site
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        <DashboardNav />
        <main id="main" className="be-fade-in min-w-0 flex-1" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
