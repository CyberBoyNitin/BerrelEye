/* BackToTop — footer pill. Smooth-scrolls (native CSS behavior) with a
 * rising arrow nudge on hover. Client island inside the server footer.
 */
"use client";

import { ArrowUp } from "@phosphor-icons/react";

export function BackToTop() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className="group inline-flex min-h-[32px] items-center gap-1.5 font-mono text-[11px] text-ink-3 transition-colors hover:text-ink-1"
    >
      Top
      <ArrowUp
        size={13}
        aria-hidden="true"
        className="transition-transform duration-200 ease-out group-hover:-translate-y-0.5"
      />
    </button>
  );
}
