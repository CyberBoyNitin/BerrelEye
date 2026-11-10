/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  ChartLine,
  ClockCounterClockwise,
  Database,
  GearSix,
  Key,
  ListDashes,
  MagnifyingGlass,
  PiggyBank,
  PlugsConnected,
  RocketLaunch,
  ShieldCheck,
  SignOut,
  SquaresFour,
  Users,
  type Icon,
} from "@phosphor-icons/react";
import { API_BASE, MeResponse, getMe, logout } from "@/lib/api";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type Section = { href: string; label: string; icon: Icon };

const groups: Array<{ title: string; items: Section[] }> = [
  {
    title: "Observe",
    items: [
      { href: "/dashboard/overview", label: "Overview", icon: SquaresFour },
      { href: "/dashboard/requests", label: "Requests", icon: ListDashes },
      { href: "/dashboard/savings", label: "Savings", icon: PiggyBank },
    ],
  },
  {
    title: "Optimize",
    items: [
      { href: "/dashboard/models", label: "Models", icon: ChartLine },
      { href: "/dashboard/providers", label: "Providers", icon: PlugsConnected },
      { href: "/dashboard/cache", label: "Cache", icon: Database },
    ],
  },
  {
    title: "Govern",
    items: [
      { href: "/dashboard/security", label: "Security", icon: ShieldCheck },
      { href: "/dashboard/keys", label: "API keys", icon: Key },
      { href: "/dashboard/members", label: "Members", icon: Users },
      { href: "/dashboard/audit", label: "Audit logs", icon: ClockCounterClockwise },
    ],
  },
  {
    title: "Setup",
    items: [
      { href: "/dashboard/onboarding", label: "Onboarding", icon: RocketLaunch },
      { href: "/dashboard/settings", label: "Settings", icon: GearSix },
    ],
  },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/dashboard/overview") return pathname === href;
  return pathname === href || pathname.startsWith(href);
}

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let alive = true;
    getMe()
      .then((m) => {
        if (alive) setMe(m);
      })
      .catch(() => {
        if (alive) setMe(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const onLogout = useCallback(async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    router.push("/login");
  }, [router]);

  const query = filter.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => it.label.toLowerCase().includes(query)),
        }))
        .filter((g) => g.items.length > 0),
    [query]
  );
  const flatItems = useMemo(() => groups.flatMap((g) => g.items), []);
  const matchCount = useMemo(
    () => flatItems.filter((it) => it.label.toLowerCase().includes(query)).length,
    [flatItems, query]
  );

  return (
    <aside
      aria-label="Dashboard navigation"
      className={cn(
        "flex w-full flex-col gap-3 lg:sticky lg:top-[76px] lg:max-h-[calc(100vh-96px)] lg:shrink-0 lg:overflow-y-auto",
        collapsed ? "lg:w-16" : "lg:w-60"
      )}
    >
      {/* Mobile: top bar with horizontally scrollable section chips */}
      <div className="lg:hidden">
        <div className="relative">
          <MagnifyingGlass
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
          />
          <label htmlFor="dashboard-section-filter-mobile" className="sr-only">
            Filter sections
          </label>
          <input
            id="dashboard-section-filter-mobile"
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter sections"
            autoComplete="off"
            className="h-[44px] w-full rounded-md border border-line-1 bg-raise pl-9 pr-3 text-sm text-ink-1 placeholder:text-ink-3"
          />
        </div>
        <nav
          className="mt-2 flex gap-1 overflow-x-auto pb-1"
          aria-label="Dashboard"
        >
          {(query ? filtered.flatMap((g) => g.items) : flatItems).map((it) => {
            const active = isActive(pathname, it.href);
            const IconCmp = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-[13px] font-medium transition-[transform,background-color,color] active:scale-[0.98]",
                  active
                    ? "border-line-2 bg-accent-wash text-ink-1"
                    : "border-transparent text-ink-2 hover:bg-hover hover:text-ink-1"
                )}
              >
                <IconCmp aria-hidden className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>
        {query && matchCount === 0 ? (
          <p className="mt-1 text-[13px] text-ink-3" role="status">
            No sections match “{filter.trim()}”.
          </p>
        ) : null}
        {/* Org card stays reachable on mobile, below the chips */}
        <div className="mt-2 rounded-lg border border-line-1 bg-card p-3">
          <p
            className="truncate text-xs font-semibold text-ink-1"
            title={me?.organization?.name ?? "—"}
          >
            {me?.organization?.name ?? "Not signed in"}
          </p>
          <p
            className="tnum mt-0.5 truncate font-mono text-[11px] text-ink-2"
            title={me?.user?.email ?? API_BASE}
          >
            {me?.user?.email ?? API_BASE}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onLogout}
              disabled={loggingOut}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md border border-line-1 bg-raise px-3 text-[13px] font-medium text-ink-1 transition-[transform,background-color] hover:bg-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              <SignOut aria-hidden className="h-4 w-4" />
              {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
          <p className="tnum mt-2 truncate font-mono text-[11px] text-ink-3" title={API_BASE}>
            {API_BASE}
          </p>
        </div>
      </div>

      {/* Desktop: slim collapsible rail */}
      <div className="hidden lg:flex lg:flex-col lg:gap-3">
        <div className="flex items-center gap-2">
          {!collapsed ? (
            <div className="relative flex-1">
              <MagnifyingGlass
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
              />
              <label htmlFor="dashboard-section-filter" className="sr-only">
                Filter sections
              </label>
              <input
                id="dashboard-section-filter"
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter sections"
                autoComplete="off"
                className="h-[40px] w-full rounded-md border border-line-1 bg-raise pl-9 pr-3 text-sm text-ink-1 placeholder:text-ink-3"
              />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="inline-flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-md border border-line-1 bg-raise text-ink-2 transition-[transform,background-color,color] hover:bg-hover hover:text-ink-1 active:scale-[0.98]"
          >
            {collapsed ? (
              <CaretRight aria-hidden className="h-4 w-4" />
            ) : (
              <CaretLeft aria-hidden className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex flex-col gap-4" aria-label="Dashboard">
          {query && matchCount === 0 ? (
            <p className="text-[13px] text-ink-3" role="status">
              {collapsed ? "No match." : `No sections match “${filter.trim()}”.`}
            </p>
          ) : null}
          {(query ? filtered : groups).map((group) => (
            <div key={group.title}>
              {!collapsed ? (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                  {group.title}
                </p>
              ) : (
                <span className="sr-only">{group.title}</span>
              )}
              <ul className="flex flex-col gap-0.5">
                {group.items.map((it) => {
                  const active = isActive(pathname, it.href);
                  const IconCmp = it.icon;
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? it.label : undefined}
                        className={cn(
                          "relative flex min-h-[40px] items-center gap-2.5 rounded-md px-3 text-[13px] font-medium transition-[transform,color] active:scale-[0.98]",
                          collapsed && "justify-center px-0",
                          active ? "text-ink-1" : "text-ink-2 hover:bg-hover hover:text-ink-1"
                        )}
                      >
                        {active ? (
                          <motion.span
                            layoutId="dash-nav-active"
                            transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
                            className="absolute inset-0 rounded-md bg-accent-wash"
                            aria-hidden="true"
                          />
                        ) : null}
                        <IconCmp aria-hidden className="relative h-[18px] w-[18px] shrink-0" />
                        {collapsed ? <span className="sr-only">{it.label}</span> : <span className="relative">{it.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {!collapsed ? (
          <div className="rounded-lg border border-line-1 bg-card p-3">
            <p
              className="truncate text-xs font-semibold text-ink-1"
              title={me?.organization?.name ?? "—"}
            >
              {me?.organization?.name ?? "Not signed in"}
            </p>
            <p
              className="tnum mt-0.5 truncate font-mono text-[11px] text-ink-2"
              title={me?.user?.email ?? API_BASE}
            >
              {me?.user?.email ?? API_BASE}
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={onLogout}
                disabled={loggingOut}
                className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-md border border-line-1 bg-raise px-3 text-[13px] font-medium text-ink-1 transition-[transform,background-color] hover:bg-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                <SignOut aria-hidden className="h-4 w-4" />
                {loggingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
            <Link
              href="/docs"
              className="mt-2 inline-flex min-h-[32px] w-full items-center justify-center gap-1 font-mono text-[11px] text-ink-2 transition-colors hover:text-ink-1"
            >
              Gateway docs
              <ArrowSquareOut aria-hidden className="h-3.5 w-3.5" />
            </Link>
            <p className="tnum mt-1 truncate text-center font-mono text-[11px] text-ink-3" title={API_BASE}>
              {API_BASE}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-line-1 bg-card p-2">
            <button
              type="button"
              onClick={onLogout}
              disabled={loggingOut}
              aria-label={loggingOut ? "Signing out" : "Sign out"}
              title={loggingOut ? "Signing out" : "Sign out"}
              className="inline-flex h-[40px] w-[40px] items-center justify-center rounded-md text-ink-2 transition-[transform,background-color,color] hover:bg-hover hover:text-ink-1 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              <SignOut aria-hidden className="h-[18px] w-[18px]" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
