/* PageHead — flagship dashboard page header.
 * Icon eyebrow + display title + description + action slot + optional meta.
 * Replaces hand-rolled headers so all 12 dashboard pages share one rhythm.
 */
import * as React from "react";
import type { Icon } from "@phosphor-icons/react";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export interface PageHeadProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow: string;
  icon?: Icon;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Small mono meta line rendered under the description (counts, ranges). */
  meta?: React.ReactNode;
}

export function PageHead({
  eyebrow,
  icon: IconCmp,
  title,
  description,
  actions,
  meta,
  className,
  ...props
}: PageHeadProps) {
  return (
    <div
      className={cn(
        "be-rise flex flex-wrap items-end justify-between gap-x-6 gap-y-4",
        className
      )}
      {...props}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">
          {IconCmp ? <IconCmp size={13} aria-hidden="true" /> : null}
          {eyebrow}
        </p>
        <h1 className="text-balance mt-1 break-all font-display text-xl font-semibold leading-none tracking-tighter text-ink-1">
          {title}
        </h1>
        {description ? (
          <p className="measure mt-1.5 max-w-2xl text-[13px] leading-6 text-ink-2">
            {description}
          </p>
        ) : null}
        {meta ? (
          <p className="tnum mt-1.5 font-mono text-xs text-ink-3">{meta}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex min-h-11 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
