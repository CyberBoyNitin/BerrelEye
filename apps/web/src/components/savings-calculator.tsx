/* SavingsCalculator — flagship interactive: your traffic in, honest
 * projection out. All math runs client-side from YOUR slider inputs;
 * results are labeled estimates, never measured savings. No signup.
 */
"use client";

import { useMemo, useState } from "react";
import { CountUp } from "@/components/ui/count-up";
import { formatInt, formatPct, formatUSD2 } from "@/lib/format";

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label
          htmlFor={id}
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-2"
        >
          {label}
        </label>
        <output
          htmlFor={id}
          className="tnum font-mono text-sm font-semibold tabular-nums text-ink-1"
        >
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="be-range mt-1"
        aria-valuetext={display}
      />
    </div>
  );
}

export function SavingsCalculator() {
  const [reqsPerDay, setReqsPerDay] = useState(20000);
  const [tokensPerReq, setTokensPerReq] = useState(1500);
  const [pricePerM, setPricePerM] = useState(2.5);
  const [cacheHit, setCacheHit] = useState(18);
  const [routeSave, setRouteSave] = useState(35);

  const calc = useMemo(() => {
    const monthlyTokens = reqsPerDay * 30 * tokensPerReq;
    const monthlySpend = (monthlyTokens / 1_000_000) * pricePerM;
    const cacheSave = monthlySpend * (cacheHit / 100);
    const routeSaveUsd = (monthlySpend - cacheSave) * (routeSave / 100);
    const total = cacheSave + routeSaveUsd;
    return { monthlySpend, cacheSave, routeSaveUsd, total };
  }, [reqsPerDay, tokensPerReq, pricePerM, cacheHit, routeSave]);

  return (
    <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-xl border border-line-1 bg-card shadow-card lg:grid-cols-2">
      <div className="space-y-6 border-b border-line-1 p-6 sm:p-8 lg:border-b-0 lg:border-r">
        <Slider
          id="calc-reqs"
          label="Requests / day"
          value={reqsPerDay}
          min={1000}
          max={200000}
          step={1000}
          display={formatInt(reqsPerDay)}
          onChange={setReqsPerDay}
        />
        <Slider
          id="calc-tokens"
          label="Avg tokens / request"
          value={tokensPerReq}
          min={200}
          max={8000}
          step={100}
          display={formatInt(tokensPerReq)}
          onChange={setTokensPerReq}
        />
        <Slider
          id="calc-price"
          label="Blended price / 1M tokens"
          value={pricePerM}
          min={0.1}
          max={30}
          step={0.1}
          display={`$${pricePerM.toFixed(2)}`}
          onChange={setPricePerM}
        />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Slider
            id="calc-cache"
            label="Cache hit rate"
            value={cacheHit}
            min={0}
            max={80}
            step={1}
            display={formatPct(cacheHit / 100)}
            onChange={setCacheHit}
          />
          <Slider
            id="calc-route"
            label="Cheaper-route saving"
            value={routeSave}
            min={0}
            max={80}
            step={1}
            display={formatPct(routeSave / 100)}
            onChange={setRouteSave}
          />
        </div>
      </div>
      <div className="flex flex-col justify-between bg-raise p-6 sm:p-8" aria-live="polite">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">
            Projected monthly saving
          </p>
          <p className="tnum mt-2 font-mono text-5xl font-semibold tracking-tighter text-ink-1 sm:text-6xl">
            <CountUp value={calc.total} format={formatUSD2} duration={400} />
          </p>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">
            estimate — not money saved
          </p>
          <dl className="mt-6 space-y-3 border-t border-line-1 pt-6 font-mono text-xs">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="uppercase tracking-[0.08em] text-ink-3">Current spend</dt>
              <dd className="tnum tabular-nums text-ink-1">{formatUSD2(calc.monthlySpend)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="uppercase tracking-[0.08em] text-ink-3">From cache</dt>
              <dd className="tnum tabular-nums text-ink-1">−{formatUSD2(calc.cacheSave)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="uppercase tracking-[0.08em] text-ink-3">From routing</dt>
              <dd className="tnum tabular-nums text-ink-1">−{formatUSD2(calc.routeSaveUsd)}</dd>
            </div>
          </dl>
        </div>
        <p className="mt-6 text-[13px] leading-6 text-ink-2">
          Point real traffic at the gateway and this projection turns into
          measured rows — priced requests with recorded routing reasons.
        </p>
      </div>
    </div>
  );
}
