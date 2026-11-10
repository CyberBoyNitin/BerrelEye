/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5
 * Pointer-tracked spotlight wrapper (decorative, hover-capable only).
 * transform/opacity stay on the element; the radial highlight is paint-only.
 */
"use client";

import { useRef, type HTMLAttributes, type MouseEvent, type ReactNode } from "react";

export function Spot({
  children,
  className,
  ...props
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);

  function move(e: MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  }

  return (
    <div ref={ref} onMouseMove={move} className={["spot", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
}
