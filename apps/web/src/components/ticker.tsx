/* Ticker — flagship mono marquee strip. Pure CSS transform animation,
 * duplicated list for a seamless loop, pauses on hover, edge-masked.
 * Content is static vocabulary (modes, guarantees) — never metrics.
 */
const WORDS = [
  "Shadow mode",
  "Every request priced",
  "Cache with consent",
  "Routing with reasons",
  "Secrets stay secret",
  "Estimates labeled",
  "OpenAI-compatible",
];

export function Ticker() {
  const row = [...WORDS, ...WORDS];
  return (
    <div
      aria-hidden="true"
      className="be-ticker-mask overflow-hidden border-b border-line-1 bg-raise py-2.5"
    >
      <div className="be-marquee flex w-max items-center gap-8 pr-8">
        {[0, 1].map((half) => (
          <div key={half} className="flex items-center gap-8">
            {row.map((w, i) => (
              <span
                key={`${half}-${i}`}
                className="flex items-center gap-8 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3"
              >
                {w}
                <span className="h-1 w-1 rounded-full bg-line-2" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
