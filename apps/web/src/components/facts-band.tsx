/* FactsBand — honest numerals only: protocol truths, not vanity metrics.
 * Counts animate when scrolled into view (IntersectionObserver), exactly
 * once, instantly under reduced motion.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { CountUp } from "@/components/ui/count-up";

const FACTS = [
  { value: 1, format: (n: number | null | undefined) => `${n ?? 0}`, label: "URL change to integrate", sub: "Point traffic at the gateway" },
  { value: 4, format: (n: number | null | undefined) => `${n ?? 0}`, label: "Routing modes", sub: "OFF · SHADOW · RECOMMEND · AUTO" },
  { value: 0, format: (n: number | null | undefined) => `${n ?? 0}`, label: "SDK changes required", sub: "OpenAI-compatible payloads" },
  { value: 100, format: (n: number | null | undefined) => `${n ?? 0}%`, label: "Requests priced with reasons", sub: "Every row inspectable" },
];

export function FactsBand() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line-1 bg-line-1 shadow-card lg:grid-cols-4">
      {FACTS.map((f, i) => (
        <div key={f.label} className="bg-card p-6 sm:p-8">
          <p className="tnum font-display text-5xl font-semibold tracking-tighter text-ink-1 sm:text-6xl">
            {visible ? (
              <CountUp value={f.value} format={f.format} duration={800 + i * 150} />
            ) : (
              f.format(0)
            )}
          </p>
          <p className="mt-3 text-sm font-semibold tracking-tight text-ink-1">{f.label}</p>
          <p className="mt-1 font-mono text-[11px] leading-5 text-ink-3">{f.sub}</p>
        </div>
      ))}
    </div>
  );
}
