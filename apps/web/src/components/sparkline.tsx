/* Sparkline — hand-rolled SVG trend line. Transform/opacity only, no
 * chart lib weight for a 120×36 hero glyph. Renders real points only;
 * empty input renders a hairline placeholder (never fabricated data).
 */
"use client";

export function Sparkline({
  points,
  width = 160,
  height = 44,
  label,
}: {
  points: number[];
  width?: number;
  height?: number;
  label: string;
}) {
  if (!points || points.length === 0) {
    return (
      <div
        role="img"
        aria-label={`${label} — no data yet`}
        className="flex items-center"
        style={{ width, height }}
      >
        <div className="h-px w-full bg-line-2" />
      </div>
    );
  }
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = points.length > 1 ? i * step : width / 2;
    const y = height - 4 - ((p - min) / span) * (height - 8);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = coords[coords.length - 1];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="overflow-visible"
    >
      <path d={area} fill="var(--be-accent-wash)" stroke="none" />
      <path d={line} fill="none" stroke="var(--be-ink-1)" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill="var(--be-ink-1)" />
    </svg>
  );
}
