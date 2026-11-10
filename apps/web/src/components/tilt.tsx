/* Tilt — pointer-fine 3D lean for the hero product visual. ±5deg springs
 * that ease back on leave. Decorative; content stays fully readable and
 * static under reduced motion, touch, or coarse pointers.
 */
"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useCallback, type MouseEvent, type ReactNode } from "react";

export function Tilt({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(my, [0, 1], [4, -4]), {
    stiffness: 150,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-5, 5]), {
    stiffness: 150,
    damping: 18,
  });

  const fine = useCallback(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !reduce,
    [reduce]
  );

  function move(e: MouseEvent<HTMLDivElement>) {
    if (!fine()) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  }
  function leave() {
    mx.set(0.5);
    my.set(0.5);
  }

  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      onMouseMove={move}
      onMouseLeave={leave}
      style={{ rotateX, rotateY, transformPerspective: 1200 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
