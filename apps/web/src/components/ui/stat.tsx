/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
import * as React from "react";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  caption?: string;
  /** Mono inverted emphasis for hero/estimate figures (text-accent). */
  accent?: boolean;
}

const deltaTones: Record<NonNullable<StatProps["deltaTone"]>, string> = {
  positive: "text-accent",
  negative: "text-danger",
  neutral: "text-ink-3",
};

// Stat: label / mono tabular value / mono delta. Plain stack — compose
// inside Card or grids. Values must come from gateway data, never invented.
export function Stat({ label, value, delta, deltaTone = "neutral", caption, accent, className, children, ...props }: StatProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)} {...props}>
      <p className="truncate text-[13px] font-medium text-ink-2">{label}{children}</p>
      <p className={cn("font-mono text-[28px] font-semibold leading-none tracking-tight tnum", accent ? "text-accent" : "text-ink-1")}>{value}</p>
      {delta ? <p className={cn("font-mono text-xs leading-5 tnum", deltaTones[deltaTone])}>{delta}</p> : null}
      {caption ? <p className="measure text-xs leading-5 text-ink-3">{caption}</p> : null}
    </div>
  );
}
