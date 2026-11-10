/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import { formatUSD2 } from "@/lib/format";

// Recharts replacements for the former hand-rolled SVG. Render ONLY real
// data passed in — callers must not synthesize points. Empty input -> null.
// Series colors come from globals.css chart tokens; tooltip/grid/axes use
// command-center tokens. Every chart must be paired with an adjacent data
// table by the caller (same numbers, see pages).

const SERIES = [
  "var(--be-chart-1)",
  "var(--be-chart-2)",
  "var(--be-chart-3)",
  "var(--be-chart-4)",
  "var(--be-chart-5)",
  "var(--be-chart-6)",
];

const TICK = {
  fill: "var(--be-ink-3)",
  fontSize: 11,
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
} as const;

function ChartTip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0];
  return (
    <div className="rounded-md border border-line-1 bg-overlay px-3 py-2 shadow-pop">
      <p className="font-mono text-[11px] text-ink-2">{String(label ?? row?.payload?.source ?? "")}</p>
      <p className="mt-0.5 font-mono text-xs font-medium tabular-nums text-ink-1">
        {row?.name}: {formatUSD2(typeof row?.value === "number" ? row.value : Number(row?.value))}
      </p>
    </div>
  );
}

// Spend-by-day bars (USD / day). Real gateway rows only.
export function SpendBars({ points }: { points: Array<{ date: string; spend: number }> }) {
  if (!points || points.length === 0) return null;
  const interval = points.length <= 14 ? 0 : Math.floor(points.length / 12);
  return (
    <div className="h-[260px] w-full" role="img" aria-label={`Spend by day in USD, ${points.length} days`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, bottom: 22, left: 4 }} barCategoryGap="28%">
          <CartesianGrid stroke="var(--be-line-1)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={TICK}
            tickLine={false}
            axisLine={{ stroke: "var(--be-line-1)" }}
            interval={interval}
            tickFormatter={(d: string | number) => String(d).slice(5)}
            label={{ value: "Date", position: "insideBottom", offset: -12, fill: "var(--be-ink-3)", fontSize: 11 }}
          />
          <YAxis
            tick={TICK}
            tickLine={false}
            axisLine={false}
            width={68}
            tickFormatter={(v: string | number) => (Math.abs(Number(v)) >= 100 ? `$${Math.round(Number(v))}` : formatUSD2(Number(v)))}
            label={{ value: "USD / day", angle: -90, position: "insideLeft", fill: "var(--be-ink-3)", fontSize: 11 }}
          />
          <Tooltip cursor={{ fill: "var(--be-hover)", opacity: 0.35 }} content={(props) => <ChartTip {...props} />} />
          <Bar dataKey="spend" name="Spend (USD)" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Savings-by-source horizontal bars (USD per source). Real gateway rows only.
export function SplitBars({ rows }: { rows: Array<{ source: string; amount: number }> }) {
  if (!rows || rows.length === 0) return null;
  const height = Math.max(200, rows.length * 52 + 72);
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`Savings by source in USD, ${rows.length} sources`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 12, bottom: 22, left: 8 }}>
          <CartesianGrid stroke="var(--be-line-1)" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={TICK}
            tickLine={false}
            axisLine={{ stroke: "var(--be-line-1)" }}
            tickFormatter={(v: string | number) => `$${Math.round(Number(v))}`}
            label={{ value: "USD", position: "insideBottom", offset: -12, fill: "var(--be-ink-3)", fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="source"
            tick={TICK}
            tickLine={false}
            axisLine={false}
            width={132}
          />
          <Tooltip cursor={{ fill: "var(--be-hover)", opacity: 0.35 }} content={(props) => <ChartTip {...props} />} />
          <Bar dataKey="amount" name="Saved (USD)" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {rows.map((r, i) => (
              <Cell key={`${r.source}-${i}`} fill={SERIES[i % SERIES.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
