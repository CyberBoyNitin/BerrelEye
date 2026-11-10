/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
"use client";

import Link from "next/link";
import { useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { Magnetic } from "@/components/magnetic";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/#features", label: "Features" },
  { href: "/#modes", label: "Modes" },
  { href: "/#estimate", label: "Estimate" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
      <header className="mx-auto max-w-6xl rounded-xl border border-line-1 bg-overlay/85 shadow-pop backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gap-3 py-2 pl-3 pr-2 sm:h-[72px] sm:pl-4 sm:pr-3">
          <Link href="/" className="flex min-h-[44px] items-center gap-2" aria-label="BerrelEye home">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent font-mono text-sm font-bold text-accent-ink">
              B
            </span>
            <span className="font-display text-sm font-semibold tracking-tight text-ink-1">
              BerrelEye
            </span>
            <span className="hidden rounded-full border border-line-1 bg-raise px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-3 lg:inline">
              AI cost gateway
            </span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="min-h-[44px] items-center text-[13px] text-ink-2 transition-colors hover:text-ink-1 md:inline-flex"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <Link
              href="/login"
              className="hidden min-h-[44px] items-center rounded-md px-3 text-[13px] font-medium text-ink-2 transition-[transform,background-color,color] hover:bg-hover hover:text-ink-1 active:scale-[0.98] sm:inline-flex"
            >
              Sign in
            </Link>
            <Magnetic>
              <Link
                href="/signup"
                className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-md bg-accent px-3 text-[13px] font-semibold text-accent-ink transition-[transform,background-color] hover:bg-accent-strong active:scale-[0.98] sm:px-4"
              >
                Get started
              </Link>
            </Magnetic>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
              className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-ink-1 transition-[transform,background-color] hover:bg-hover active:scale-[0.98] md:hidden"
            >
              {open ? <X size={20} aria-hidden="true" /> : <List size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>
        {open ? (
          <nav className="be-fade-in border-t border-line-1 px-2 py-2 md:hidden" aria-label="Mobile">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex min-h-[48px] items-center rounded-md px-3 text-[15px] font-medium text-ink-1 transition-colors hover:bg-hover active:scale-[0.99]"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="flex min-h-[48px] items-center rounded-md px-3 text-[15px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink-1 sm:hidden"
            >
              Sign in
            </Link>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
                Theme
              </span>
              <ThemeToggle />
            </div>
          </nav>
        ) : null}
      </header>
    </div>
  );
}
