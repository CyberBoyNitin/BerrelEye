/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
import * as React from "react";
import Link from "next/link";
import { Button } from "./button";

// Honest empty state: on-system card, states what is missing and the next
// real action. Never implies fabricated data.
export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  icon,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-2 bg-card px-6 py-14 text-center">
      <div
        className="flex h-11 w-11 items-center justify-center rounded-full border border-line-1 bg-raise font-mono text-sm text-ink-3"
        aria-hidden
      >
        {icon ?? "∅"}
      </div>
      <h3 className="mt-4 font-display text-[15px] font-semibold tracking-tight text-ink-1">{title}</h3>
      <p className="measure mt-1.5 max-w-md text-[13px] leading-6 text-ink-2">{description}</p>
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="mt-6 inline-flex min-h-11 items-center">
          <Button>{actionLabel}</Button>
        </Link>
      ) : null}
      {actionLabel && !actionHref && onAction ? (
        <div className="mt-6">
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      ) : null}
    </div>
  );
}

// Honest error state: names the failure, shows the gateway message verbatim
// in mono, states the no-fabrication rule, offers retry. No invented detail.
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-line-1 bg-card px-6 py-8 text-center shadow-card" role="alert">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-danger">Request failed</p>
      <p className="mt-2 font-display text-[15px] font-semibold tracking-tight text-ink-1">Couldn&apos;t load live data</p>
      <p className="mx-auto mt-2 max-w-xl break-words font-mono text-xs leading-5 text-ink-2 tnum">{message}</p>
      <p className="measure mx-auto mt-2 max-w-xl text-xs leading-5 text-ink-3">
        Numbers are never fabricated — this page only renders gateway data. Start the gateway and retry.
      </p>
      {onRetry ? (
        <div className="mt-5">
          <Button variant="outline" onClick={onRetry}>Retry</Button>
        </div>
      ) : null}
    </div>
  );
}
