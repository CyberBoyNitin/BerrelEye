/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
import * as React from "react";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export interface ChartCardProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Chart slot (recharts). Keep series to var(--be-chart-1..6). */
  children: React.ReactNode;
  /** Table/summary alternative — every chart ships one. */
  alternative?: React.ReactNode;
}

// ChartCard: title + action + chart slot + table-alternative slot.
// Fixed chart height reserves space (CLS < 0.1); alternative is one click away.
export function ChartCard({ title, description, action, children, alternative, className, ...props }: ChartCardProps) {
  return (
    <section className={cn("rounded-xl border border-line-1 bg-card shadow-card", className)} {...props}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 p-6 pb-4">
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-semibold tracking-tight text-ink-1">{title}</h3>
          {description ? <p className="measure mt-1 text-[13px] leading-6 text-ink-2">{description}</p> : null}
        </div>
        {action ? <div className="flex items-center gap-2">{action}</div> : null}
      </div>
      <div className="px-6 pb-6">
        <div className="min-h-[240px] w-full">{children}</div>
      </div>
      {alternative ? (
        <details className="group border-t border-line-1">
          <summary className="flex min-h-11 cursor-pointer list-none items-center px-6 py-3 text-[13px] font-medium text-ink-2 transition-colors duration-150 ease-out hover:text-ink-1 [&::-webkit-details-marker]:hidden">
            View data table
          </summary>
          <div className="overflow-x-auto px-6 pb-6">{alternative}</div>
        </details>
      ) : null}
    </section>
  );
}
