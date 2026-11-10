/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
import * as React from "react";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export interface SectionHeadProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

// SectionHead: eyebrow + display title + optional action slot.
// Sentence case text; styling never transforms meaning.
export function SectionHead({ eyebrow, title, description, action, className, ...props }: SectionHeadProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)} {...props}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">{eyebrow}</p>
        ) : null}
        <h2 className="mt-1 font-display text-xl font-semibold tracking-tighter leading-none text-balance text-ink-1">
          {title}
        </h2>
        {description ? (
          <p className="measure mt-1.5 max-w-2xl text-[13px] leading-6 text-ink-2">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex min-h-11 items-center gap-2">{action}</div> : null}
    </div>
  );
}
