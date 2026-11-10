/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5
 * CSS-only entrance: SSR-safe (no opacity-0 hydration trap), reduced-motion
 * handled in globals.css. JS animation libs are for springs/gestures only.
 */
import type { ReactNode } from "react";

const DELAY_CLASS = ["", "be-rise-1", "be-rise-2", "be-rise-3"] as const;

export function HeroMotion({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const step = Math.min(3, Math.max(0, Math.round(delay / 0.06)));
  const cls = ["be-rise", DELAY_CLASS[step], className].filter(Boolean).join(" ");
  return <div className={cls}>{children}</div>;
}
