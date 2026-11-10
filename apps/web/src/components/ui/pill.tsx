/* Pill — unified mono status pill. Strict black & white: tones differ by
 * dot fill, border weight, and text emphasis — never by hue — so meaning
 * survives without color (a11y: color is never the only signal).
 */
import * as React from "react";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export type PillTone = "live" | "info" | "alert" | "warn" | "plain";

const tones: Record<PillTone, { pill: string; dot: string }> = {
  live: { pill: "border-line-2 bg-accent-wash font-semibold text-ink-1", dot: "bg-ink-1" },
  info: { pill: "border-line-2 text-ink-1", dot: "bg-ink-1" },
  alert: { pill: "border-line-2 border-dashed font-semibold text-ink-1", dot: "bg-ink-1" },
  warn: { pill: "border-line-1 text-ink-2", dot: "bg-ink-3" },
  plain: { pill: "border-line-1 text-ink-2", dot: "bg-ink-3" },
};

export function Pill({
  tone = "plain",
  dot = true,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: PillTone; dot?: boolean }) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium leading-4",
        t.pill,
        className
      )}
      {...props}
    >
      {dot ? (
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} />
      ) : null}
      {children}
    </span>
  );
}
