/* Faq — real questions with documented answers. Single-open accordion,
 * height animated with the grid-rows trick (transform/opacity-safe,
 * no layout-thrash JS). Keyboard-native buttons with aria-expanded.
 */
"use client";

import { useState } from "react";
import { Minus, Plus } from "@phosphor-icons/react";

const ITEMS = [
  {
    q: "Does BerrelEye change which model answers my users?",
    a: "Not unless you ask it to. The default SHADOW mode keeps your requested model and only records what a cheaper route would have done. Switch a policy to AUTO when the rows convince you — every reroute carries recorded reasons.",
  },
  {
    q: "Where do my provider keys live?",
    a: "On the gateway server, encrypted at rest. They are never returned to the browser — the dashboard shows metadata (provider, dev-only flag, enabled state) but never raw secrets. A gateway API key reveals its full secret once, at creation.",
  },
  {
    q: "What does “estimated savings” actually mean?",
    a: "A projection, not money saved. The dashboard keeps measured spend and estimated optimized spend as separate numbers, and every projection is labeled an estimate. We never present a projection as cash in hand.",
  },
  {
    q: "Do I need to change my SDK or prompts?",
    a: "No. BerrelEye speaks the OpenAI chat-completions protocol: swap the base URL for your gateway endpoint, send the same payload, and keep your SDK, prompts, and streaming code untouched.",
  },
  {
    q: "What happens when a provider fails?",
    a: "The gateway retries and can fall back across configured providers. Failed attempts are recorded on the request row — provider success rate in Overview comes from those real attempts, not uptime claims.",
  },
  {
    q: "Can I keep a request out of the cache?",
    a: "Yes. Send X-AI-Cache: no-store to bypass on any request. Exact cache is on by default; semantic similarity cache is opt-in behind your own threshold, and tool calls and transactions are never cached.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-line-1 rounded-xl border border-line-1 bg-card shadow-card">
      {ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${i}`}
              className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors duration-150 ease-out hover:bg-hover sm:px-6 sm:py-5"
            >
              <span className="tnum w-8 shrink-0 font-mono text-xs text-ink-3">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 text-balance text-[15px] font-semibold tracking-tight text-ink-1">
                {item.q}
              </span>
              <span
                aria-hidden="true"
                className={[
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-[transform,background-color,color] duration-200 ease-out active:scale-90",
                  isOpen
                    ? "border-transparent bg-accent text-accent-ink"
                    : "border-line-1 text-ink-2 group-hover:border-line-2 group-hover:text-ink-1",
                ].join(" ")}
              >
                {isOpen ? <Minus size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
              </span>
            </button>
            <div
              id={`faq-panel-${i}`}
              data-open={isOpen}
              className="be-collapse"
            >
              <div>
                <p className="measure max-w-3xl px-5 pb-5 pl-[68px] pr-6 text-sm leading-7 text-ink-2 sm:px-6 sm:pl-[76px]">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
