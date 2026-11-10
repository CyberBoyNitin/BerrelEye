/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
import * as React from "react";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// Flagship tones: on-system fills, single accent for success/live,
// semantic text-danger / text-warn only. Mono + tabular numerals.
const tones: Record<string, string> = {
  default: "border-line-1 bg-raise text-ink-2",
  success: "border-line-1 bg-accent-wash text-accent",
  warning: "border-line-1 bg-raise text-warn",
  danger: "border-line-1 bg-raise text-danger",
  info: "border-line-1 bg-hover text-ink-1",
  muted: "border-line-1 bg-transparent text-ink-3",
};

export function Badge({
  tone = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium leading-4 tnum",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

// Shape-matching shimmer: callers size the block to the final shape.
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("be-shimmer rounded-md bg-hover", className)}
      aria-hidden
      {...props}
    />
  );
}

export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-line-1 bg-card" aria-label="Loading table">
      <div className="border-b border-line-1 bg-raise px-4 py-3">
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="divide-y divide-line-1">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex min-h-11 items-center gap-3 px-4 py-3">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-line-1 bg-card p-6 shadow-card">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-32" />
          <Skeleton className="mt-2 h-3 w-40" />
        </div>
      ))}
    </div>
  );
}
