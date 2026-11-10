/* ModeExplorer — interactive routing-mode tabs. Segmented control with a
 * sliding ink pill (motion layoutId); panel crossfades with AnimatePresence.
 * Policy JSON is the real gateway payload shape; outcomes describe actual
 * gateway behavior per mode.
 */
"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { CopyButton } from "@/app/docs/copy-button";

type Mode = "OFF" | "SHADOW" | "RECOMMEND" | "AUTO";

const MODES: Mode[] = ["OFF", "SHADOW", "RECOMMEND", "AUTO"];

const DETAIL: Record<Mode, { policy: string; outcome: string; note: string }> = {
  OFF: {
    policy: `{"optimization_mode": "OFF"}`,
    outcome: "The requested model always answers. BerrelEye meters cost only.",
    note: "Explicit model choice is never overridden.",
  },
  SHADOW: {
    policy: `{"optimization_mode": "SHADOW"}`,
    outcome: "Traffic keeps its model. Cheaper-route analysis is recorded per request.",
    note: "The default. Zero behavior change while evidence accumulates.",
  },
  RECOMMEND: {
    policy: `{"optimization_mode": "RECOMMEND"}`,
    outcome: "The model is unchanged. Potential optimizations surface beside each decision.",
    note: "Review recommendations, then switch a policy to AUTO when convinced.",
  },
  AUTO: {
    policy: `{"optimization_mode": "AUTO"}`,
    outcome: "The gateway may select a cheaper capable route for eligible requests.",
    note: "Every reroute carries recorded reasons, inspectable in Request detail.",
  },
};

export function ModeExplorer() {
  const [mode, setMode] = useState<Mode>("SHADOW");
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const d = DETAIL[mode];

  return (
    <div className="overflow-hidden rounded-xl border border-line-1 bg-card shadow-card">
      <div
        role="tablist"
        aria-label="Routing modes"
        className="flex gap-1 overflow-x-auto border-b border-line-1 bg-raise p-2 no-scrollbar"
      >
        {MODES.map((m) => {
          const selected = m === mode;
          return (
            <button
              key={m}
              role="tab"
              aria-selected={selected}
              onClick={() => setMode(m)}
              className={[
                "relative min-h-[44px] flex-1 whitespace-nowrap rounded-md px-4 font-mono text-xs font-semibold tracking-wide transition-[transform,color] duration-150 ease-out active:scale-[0.97]",
                selected ? "text-accent-ink" : "text-ink-3 hover:text-ink-1",
              ].join(" ")}
            >
              {selected ? (
                <motion.span
                  layoutId={`mode-ink-${id}`}
                  transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
                  className="absolute inset-0 rounded-md bg-accent"
                  aria-hidden="true"
                />
              ) : null}
              <span className="relative">{m}</span>
            </button>
          );
        })}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          role="tabpanel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="grid grid-cols-1 gap-0 lg:grid-cols-2"
        >
          <div className="border-b border-line-1 p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
              Policy payload
            </p>
            <div className="mt-3 flex items-start justify-between gap-3 rounded-md border border-line-1 bg-raise p-4">
              <pre className="tnum overflow-x-auto font-mono text-xs leading-6 text-ink-1">
                {`PUT /api/settings\n${d.policy}`}
              </pre>
              <CopyButton text={d.policy} />
            </div>
            <p className="mt-3 text-[13px] leading-6 text-ink-2">{d.note}</p>
          </div>
          <div className="flex flex-col justify-center bg-raise p-6 sm:p-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
              What happens to traffic
            </p>
            <p className="text-balance mt-3 font-display text-xl font-semibold leading-snug tracking-tight text-ink-1">
              {d.outcome}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
