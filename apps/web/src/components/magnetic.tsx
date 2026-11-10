/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5
 * Magnetic pressable: ≤6px pull toward the cursor, pointer-fine only,
 * off under reduced motion. Decorative; the link stays a real link.
 */
"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";

export function Magnetic({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  function fine() {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function move(e: MouseEvent) {
    const el = ref.current;
    if (!el || !fine()) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(6, Math.max(-6, (e.clientX - (r.left + r.width / 2)) / 28));
    const y = Math.min(6, Math.max(-6, (e.clientY - (r.top + r.height / 2)) / 28));
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  function leave() {
    const el = ref.current;
    if (el) el.style.transform = "";
  }

  return (
    <div
      ref={ref}
      onMouseMove={move}
      onMouseLeave={leave}
      className={["inline-block transition-transform duration-150 ease-out", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
