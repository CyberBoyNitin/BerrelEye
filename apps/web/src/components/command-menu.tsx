/* CommandMenu — flagship ⌘K quick navigation for the dashboard.
 * Client-only, SSR-safe (renders nothing until mounted). Keyboard-first:
 * ↑↓ move, Enter visits, Esc closes. Origin-aware pop (be-pop).
 */
"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChartLine,
  ClockCounterClockwise,
  Command,
  Database,
  GearSix,
  Key,
  ListDashes,
  MagnifyingGlass,
  PiggyBank,
  PlugsConnected,
  RocketLaunch,
  ShieldCheck,
  SquaresFour,
  Users,
  type Icon,
} from "@phosphor-icons/react";

export type CommandItem = { href: string; label: string; hint: string; icon: Icon };

const GROUPS: Array<{ title: string; items: CommandItem[] }> = [
  {
    title: "Observe",
    items: [
      { href: "/dashboard/overview", label: "Overview", hint: "Spend & savings", icon: SquaresFour },
      { href: "/dashboard/requests", label: "Requests", hint: "Per-request trace", icon: ListDashes },
      { href: "/dashboard/savings", label: "Savings", hint: "Proven vs estimated", icon: PiggyBank },
    ],
  },
  {
    title: "Optimize",
    items: [
      { href: "/dashboard/models", label: "Models", hint: "Cost by model", icon: ChartLine },
      { href: "/dashboard/providers", label: "Providers", hint: "Keys & routing", icon: PlugsConnected },
      { href: "/dashboard/cache", label: "Cache", hint: "Hits & policy", icon: Database },
    ],
  },
  {
    title: "Govern",
    items: [
      { href: "/dashboard/security", label: "Security", hint: "PII & blocks", icon: ShieldCheck },
      { href: "/dashboard/keys", label: "API keys", hint: "Gateway access", icon: Key },
      { href: "/dashboard/members", label: "Members", hint: "Team access", icon: Users },
      { href: "/dashboard/audit", label: "Audit logs", hint: "Who did what", icon: ClockCounterClockwise },
    ],
  },
  {
    title: "Setup",
    items: [
      { href: "/dashboard/onboarding", label: "Onboarding", hint: "First request", icon: RocketLaunch },
      { href: "/dashboard/settings", label: "Settings", hint: "Policy & org", icon: GearSix },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-1 bg-raise px-1 font-mono text-[10px] text-ink-3">
      {children}
    </kbd>
  );
}

export function CommandMenuTrigger() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open command menu (Control K)"
        className="hidden min-h-[40px] items-center gap-2 rounded-md border border-line-1 bg-raise px-3 text-[13px] text-ink-3 transition-[transform,background-color,color] hover:bg-hover hover:text-ink-1 active:scale-[0.98] md:inline-flex"
      >
        <MagnifyingGlass size={15} aria-hidden="true" />
        <span className="hidden lg:inline">Jump to…</span>
        <span className="hidden items-center gap-1 lg:inline-flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      {open ? <CommandMenu onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function CommandMenu({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const flat = useMemo(() => {
    const all = GROUPS.flatMap((g) =>
      g.items.map((it) => ({ ...it, group: g.title }))
    );
    if (!q) return all;
    return all.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        it.hint.toLowerCase().includes(q) ||
        it.group.toLowerCase().includes(q)
    );
  }, [q]);

  useEffect(() => {
    setCursor(0);
  }, [q]);

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(flat.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = flat[cursor];
      if (it) go(it.href);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Jump to dashboard section"
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        aria-label="Close command menu"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <div className="be-pop relative w-full max-w-lg overflow-hidden rounded-xl border border-line-1 bg-overlay shadow-pop">
        <div className="flex items-center gap-2 border-b border-line-1 px-4">
          <Command size={16} aria-hidden="true" className="shrink-0 text-ink-3" />
          <label htmlFor="command-menu-input" className="sr-only">
            Jump to dashboard section
          </label>
          <input
            ref={inputRef}
            id="command-menu-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a section — overview, keys, cache…"
            autoComplete="off"
            className="h-12 w-full bg-transparent text-sm text-ink-1 outline-none placeholder:text-ink-3"
          />
          <Kbd>esc</Kbd>
        </div>
        <div ref={listRef} className="max-h-[320px] overflow-y-auto p-2" role="listbox" aria-label="Sections">
          {flat.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-ink-3" role="status">
              No section matches “{query.trim()}”.
            </p>
          ) : (
            flat.map((it, i) => {
              const IconCmp = it.icon;
              const active = i === cursor;
              return (
                <button
                  key={it.href}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-index={i}
                  onMouseMove={() => setCursor(i)}
                  onClick={() => go(it.href)}
                  className={[
                    "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors duration-100 ease-out",
                    active ? "bg-hover" : "",
                  ].join(" ")}
                >
                  <IconCmp size={17} aria-hidden="true" className="shrink-0 text-ink-2" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink-1">
                      {it.label}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-ink-3">
                      {it.group} · {it.hint}
                    </span>
                  </span>
                  {active ? <Kbd>↵</Kbd> : null}
                </button>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-line-1 px-4 py-2.5 font-mono text-[10px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> open
          </span>
          <span className="ml-auto">12 sections</span>
        </div>
      </div>
    </div>
  );
}
