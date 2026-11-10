/* HeroMock — CSS-only product visual: the request ledger, framed like a
 * browser window. Rows cycle a passing highlight (pure CSS, staggered
 * delays). Sample rows are an ILLUSTRATIVE preview — labeled as such —
 * never presented as real customer data.
 */
"use client";

import { CountUp } from "@/components/ui/count-up";
import { Pill } from "@/components/ui/pill";

const ROWS = [
  { id: "req_8f3a…c21d", route: "gpt-4o → gpt-4o-mini", mode: "SHADOW", cost: "$0.0041", cache: "miss" },
  { id: "req_51be…9a07", route: "claude-sonnet → haiku", mode: "SHADOW", cost: "$0.0018", cache: "hit" },
  { id: "req_ad44…f5b2", route: "gpt-4o → gpt-4o-mini", mode: "AUTO", cost: "$0.0022", cache: "miss" },
  { id: "req_07c1…d8e4", route: "embed → cached", mode: "AUTO", cost: "$0.0000", cache: "hit" },
] as const;

function TrafficBars() {
  const bars = [38, 62, 45, 80, 55, 92, 70, 48, 66, 84, 58, 74];
  return (
    <div className="flex h-10 items-end gap-1" aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          style={{ height: `${h}%`, animationDelay: `${i * 120}ms` }}
          className="be-rise w-full rounded-sm bg-ink-1/80"
        />
      ))}
    </div>
  );
}

export function HeroMock() {
  return (
    <figure aria-label="Illustrative preview of the BerrelEye request ledger">
      <div className="overflow-hidden rounded-xl border border-line-1 bg-card shadow-pop">
        {/* window chrome */}
        <div className="flex items-center gap-1.5 border-b border-line-1 bg-raise px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-line-2" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-2" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-2" aria-hidden="true" />
          <span className="tnum ml-2 truncate font-mono text-[11px] text-ink-3">
            berreleye · request ledger
          </span>
          <span className="ml-auto hidden sm:inline">
            <Pill tone="live">illustrative preview</Pill>
          </span>
        </div>
        <div className="grid grid-cols-1 gap-0 md:grid-cols-[1.4fr_1fr]">
          {/* ledger rows */}
          <ul className="divide-y divide-line-1">
            {ROWS.map((r, i) => (
              <li
                key={r.id}
                style={{ animationDelay: `${i * 1.8}s` }}
                className="be-row-cycle flex items-center gap-3 px-4 py-3"
              >
                <span
                  aria-hidden="true"
                  style={{ animationDelay: `${i * 1.8}s` }}
                  className="be-row-cycle-active-dot be-row-dot h-1.5 w-1.5 shrink-0 rounded-full bg-ink-1"
                />
                <span className="tnum min-w-0 flex-1 truncate font-mono text-xs text-ink-1">
                  {r.id}
                  <span className="mt-0.5 block truncate text-[11px] text-ink-3">{r.route}</span>
                </span>
                <span className="hidden shrink-0 sm:inline">
                  <Pill tone={r.mode === "AUTO" ? "info" : "plain"}>{r.mode}</Pill>
                </span>
                <span className="hidden shrink-0 md:inline">
                  <Pill tone={r.cache === "hit" ? "live" : "plain"}>{r.cache}</Pill>
                </span>
                <span className="tnum shrink-0 font-mono text-xs tabular-nums text-ink-1">
                  {r.cost}
                </span>
              </li>
            ))}
          </ul>
          {/* savings side */}
          <div className="border-t border-line-1 bg-raise p-4 md:border-l md:border-t-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
              Potential savings · est.
            </p>
            <p className="tnum mt-1 font-mono text-3xl font-semibold tracking-tighter text-ink-1">
              <CountUp value={1284.06} format={(n) => `$${(n ?? 0).toFixed(2)}`} duration={1400} />
            </p>
            <div className="mt-3">
              <TrafficBars />
            </div>
            <p className="mt-2 font-mono text-[10px] leading-4 text-ink-3">
              12 days · measured vs. optimized
            </p>
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-center font-mono text-[11px] text-ink-3">
        Illustrative preview — your rows appear after the first real request.
      </figcaption>
    </figure>
  );
}
