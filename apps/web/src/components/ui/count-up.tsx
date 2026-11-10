/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
"use client";

import { useEffect, useRef, useState } from "react";

// CountUp: rAF-animated numeric display with tabular numerals.
// Renders the REAL final value immediately on the server / no-JS and
// instantly (no animation) under prefers-reduced-motion. Callers pass the
// raw number plus their existing formatter (formatUSD2, formatInt, ...)
// so no value is ever invented — formatting stays identical.
export function CountUp({
  value,
  format,
  duration = 900,
  className,
}: {
  value: number | null | undefined;
  format: (n: number | null | undefined) => string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(() => format(value));
  const raf = useRef<number>(0);
  const fromRef = useRef<number>(0);

  useEffect(() => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      setDisplay(format(value));
      return;
    }
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduced = false;
    }
    if (reduced || duration <= 0) {
      setDisplay(format(value));
      return;
    }
    const from = fromRef.current || 0;
    const to = value;
    if (from === to) {
      setDisplay(format(to));
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic: fast start, gentle landing (no ease-in).
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setDisplay(format(current));
      if (t < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      fromRef.current = to;
    };
  }, [value, duration, format]);

  return (
    <span className={["tnum tabular-nums", className].filter(Boolean).join(" ")}>
      {display}
    </span>
  );
}
