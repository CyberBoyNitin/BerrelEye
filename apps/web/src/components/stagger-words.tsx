/* StaggerWords — editorial headline reveal. Words slide up from an
 * overflow mask with a 55ms stagger, expo-out, transform-only. SSR-safe:
 * plain text until hydrated; instant under reduced motion.
 */
"use client";

import { motion, useReducedMotion } from "motion/react";

export function StaggerWords({
  text,
  className,
  id,
}: {
  text: string;
  className?: string;
  id?: string;
}) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  if (reduce) {
    return (
      <h1 id={id} className={className}>
        {text}
      </h1>
    );
  }
  return (
    <h1 id={id} className={className} aria-label={text}>
      {words.map((w, i) => (
        <span
          key={`${w}-${i}`}
          aria-hidden="true"
          className="inline-block overflow-hidden pb-[0.08em] align-bottom"
        >
          <motion.span
            className="inline-block will-change-transform"
            initial={{ y: "110%" }}
            animate={{ y: "0%" }}
            transition={{
              duration: 0.65,
              delay: 0.1 + i * 0.055,
              ease: [0.23, 1, 0.32, 1],
            }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}
