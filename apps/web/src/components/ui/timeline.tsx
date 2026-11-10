/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
import * as React from "react";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export interface TimelineItem {
  key?: string;
  title: string;
  timestamp?: string;
  description?: string;
  tone?: "default" | "accent" | "success" | "warning" | "danger";
}

const dots: Record<NonNullable<TimelineItem["tone"]>, string> = {
  default: "border border-line-2 bg-hover",
  accent: "bg-accent",
  success: "bg-accent",
  warning: "bg-warn",
  danger: "bg-danger",
};

// Timeline: vertical steps with mono tabular timestamps. Used for routing
// decisions, attempts, and audit trails. Renders only supplied items.
export function Timeline({ items, className, ...props }: React.HTMLAttributes<HTMLOListElement> & { items: TimelineItem[] }) {
  return (
    <ol className={cn("flex flex-col", className)} {...props}>
      {items.map((item, i) => (
        <li key={item.key ?? `${item.title}-${i}`} className="relative flex min-h-11 gap-4 pb-6 last:pb-0">
          {i < items.length - 1 ? (
            <span aria-hidden className="absolute bottom-0 left-[5px] top-7 w-px bg-line-1" />
          ) : null}
          <span aria-hidden className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", dots[item.tone ?? "default"])} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <p className="text-sm font-medium text-ink-1">{item.title}</p>
              {item.timestamp ? (
                <time className="font-mono text-[11px] leading-4 text-ink-3 tnum">{item.timestamp}</time>
              ) : null}
            </div>
            {item.description ? (
              <p className="measure mt-1 text-[13px] leading-6 text-ink-2">{item.description}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
