/* ScrollReveal — whileInView entrance, transform + opacity only.
 * SSR-safe: content renders visible; motion enhances on the client.
 * Stagger via `delay` (30–80ms steps). Respects reduced motion via
 * MotionConfig reducedMotion="user" (set once in providers or layout).
 */
"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function ScrollReveal({
  children,
  delay = 0,
  y = 14,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}
