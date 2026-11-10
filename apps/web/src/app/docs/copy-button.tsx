"use client";

/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-1 bg-card px-2 font-mono text-[11px] text-ink-2 transition-colors hover:bg-hover hover:text-ink-1 active:scale-[0.98]"
      aria-label={copied ? "Copied" : "Copy code"}
      aria-live="polite"
    >
      {copied ? (
        <>
          <Check size={13} aria-hidden="true" /> Copied
        </>
      ) : (
        <>
          <Copy size={13} aria-hidden="true" /> Copy
        </>
      )}
    </button>
  );
}
