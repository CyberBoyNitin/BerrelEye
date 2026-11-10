/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5
 * macrostructure: saas-flagship · genre: swiss-editorial · theme: mono-light
 * Strict black & white. Honest copy only — no metrics, logos, testimonials.
 * Product visuals are labeled illustrative previews, never real data.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HeroMotion } from "@/components/landing-hero-motion";
import { HeroMock } from "@/components/hero-mock";
import { LiveConsole } from "@/components/live-console";
import { Magnetic } from "@/components/magnetic";
import { ModeExplorer } from "@/components/mode-explorer";
import { SavingsCalculator } from "@/components/savings-calculator";
import { SdkTabs } from "@/components/sdk-tabs";
import { FactsBand } from "@/components/facts-band";
import { Faq } from "@/components/faq";
import { ScrollProgress } from "@/components/scroll-progress";
import { ScrollReveal } from "@/components/scroll-reveal";
import { Spot } from "@/components/spot";
import { StaggerWords } from "@/components/stagger-words";
import { Ticker } from "@/components/ticker";
import { Tilt } from "@/components/tilt";
import { WebGLBackground } from "@/components/webgl-background";

export const metadata: Metadata = {
  title: "BerrelEye — Mission Control for AI Spend",
  description:
    "Point OpenAI-compatible traffic at BerrelEye. Every request priced, every routing decision recorded.",
};

const POLICY_CURL = `curl -X PUT http://localhost:8080/api/settings \\
  -H "Content-Type: application/json" \\
  -d '{"routing_policy": {"optimization_mode": "SHADOW"}}'`;

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
      <span className="be-ping absolute inline-flex h-full w-full rounded-full bg-ink-1" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-ink-1" />
    </span>
  );
}

function Eyebrow({ index, children }: { index: string; children: string }) {
  return (
    <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-ink-3">
      <span className="tnum text-ink-1">{index}</span>
      <span aria-hidden="true" className="h-px w-8 bg-line-2" />
      {children}
    </p>
  );
}

const FEATURES = [
  {
    n: "01",
    title: "Routing you can inspect",
    body: "Start in SHADOW: traffic keeps its model while BerrelEye records what a cheaper route would have done. Switch modes per organization when the rows convince you.",
    code: POLICY_CURL,
    span: "md:col-span-4",
  },
  {
    n: "02",
    title: "Cache with consent",
    body: "Exact cache on. Semantic cache is opt-in with a threshold you set. Bypass any request with X-AI-Cache: no-store.",
    span: "md:col-span-2",
  },
  {
    n: "03",
    title: "Secrets stay secret",
    body: "Provider credentials are encrypted at rest and never returned to the browser. A gateway key shows its full secret once, at creation.",
    span: "md:col-span-2",
  },
  {
    n: "04",
    title: "Investigate to the row",
    body: "Overview surfaces spend, then each request opens a timeline: policy, decision reasons, provider attempts, cost math, cache result. Follow a spike back to its source.",
    span: "md:col-span-4",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-paper font-display text-ink-1">
      <ScrollProgress />
      <SiteHeader />
      <main id="main">
        {/* 01 — Hero */}
        <section aria-labelledby="hero-heading" className="be-grain relative overflow-x-clip border-b border-line-1">
          <WebGLBackground variant="paper" themed />
          <div aria-hidden="true" className="be-beam pointer-events-none absolute inset-y-0 left-0 w-[40vw]" />
          <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-28 sm:px-6 sm:pt-32 lg:pb-20 lg:pt-40">
            <div className="mx-auto max-w-4xl text-center">
              <div className="be-rise">
                <p className="inline-flex items-center gap-2 rounded-full border border-line-1 bg-raise px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-ink-2">
                  <LiveDot />
                  01 · OpenAI-compatible gateway
                </p>
              </div>
              <StaggerWords
                id="hero-heading"
                text="Every request priced. Every saving proven."
                className="text-balance mt-6 font-display text-6xl font-semibold leading-[0.95] tracking-tighter md:text-8xl"
              />
              <div className="be-rise be-rise-2">
                <p className="measure mx-auto mt-5 max-w-xl text-base leading-7 text-ink-2">
                  Point OpenAI-compatible traffic at BerrelEye. We record cost, route cheaper, and show proof.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                  <Magnetic>
                    <Link
                      href="/signup"
                      className="group inline-flex min-h-[48px] items-center gap-2 rounded-full bg-accent px-7 text-base font-semibold text-accent-ink transition-[background-color] hover:bg-accent-strong active:scale-[0.98]"
                    >
                      Start saving
                      <ArrowRight size={18} aria-hidden="true" className="transition-transform duration-200 ease-out group-hover:translate-x-1" />
                    </Link>
                  </Magnetic>
                  <Link
                    href="#console"
                    className="inline-flex min-h-[48px] items-center gap-1.5 rounded-full border border-line-2 px-6 text-base font-medium transition-[background-color,transform] hover:bg-hover active:scale-[0.98]"
                  >
                    Try it live
                    <ArrowUpRight size={18} aria-hidden="true" />
                  </Link>
                </div>
                <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
                  Self-host with Docker · No SDK changes
                </p>
              </div>
            </div>
            <HeroMotion delay={0.18} className="mx-auto mt-12 max-w-5xl lg:mt-16">
              <Tilt>
                <HeroMock />
              </Tilt>
            </HeroMotion>
          </div>
        </section>
        <Ticker />

        {/* 02 — Live console */}
        <section id="console" aria-labelledby="console-heading" className="relative overflow-hidden border-b border-line-1">
          <div aria-hidden="true" className="be-grid-pan absolute inset-0 opacity-70" />
          <div className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 lg:py-20">
            <ScrollReveal>
              <Eyebrow index="02">Try it live</Eyebrow>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                <h2 id="console-heading" className="max-w-xl text-balance text-3xl font-semibold tracking-tighter md:text-4xl">
                  Send a request through the real pipeline.
                </h2>
                <p className="font-mono text-[11px] uppercase tracking-widest text-ink-3">no signup · uses the test key</p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.08} className="mt-8">
              <LiveConsole />
            </ScrollReveal>
          </div>
        </section>

        {/* 03 — Routing modes */}
        <section id="modes" aria-labelledby="modes-heading" className="relative overflow-hidden border-b border-line-1 bg-raise/60">
          <div aria-hidden="true" className="be-beam pointer-events-none absolute inset-y-0 left-0 w-[40vw]" />
          <div className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 lg:py-20">
            <ScrollReveal>
              <Eyebrow index="03">Routing modes</Eyebrow>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                <h2 id="modes-heading" className="max-w-xl text-balance text-3xl font-semibold tracking-tighter md:text-4xl">
                  Four modes. You choose how bold it gets.
                </h2>
                <p className="font-mono text-[11px] uppercase tracking-widest text-ink-3">tap a mode · policy is real</p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.08} className="mt-8">
              <ModeExplorer />
            </ScrollReveal>
          </div>
        </section>

        {/* 04 — Proof ledger */}
        <section id="proof" aria-labelledby="proof-heading" className="relative overflow-hidden border-b border-line-1">
          <div aria-hidden="true" className="be-scan pointer-events-none absolute inset-x-0 top-0 h-32" />
          <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <ScrollReveal>
              <Eyebrow index="04">How it proves it</Eyebrow>
              <h2 id="proof-heading" className="mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tighter md:text-4xl">
                Pipeline stages, not promises
              </h2>
            </ScrollReveal>
            <ol className="mt-10 border-t border-line-1">
              {[
                ["01", "Request recorded", "Method, model, tokens, latency, and cache result land as one inspectable row."],
                ["02", "Routing decision", "Mode and reasons recorded: OFF, SHADOW, RECOMMEND, or AUTO. Nothing changes silently."],
                ["03", "Cost row", "Priced usage with estimate-labeled projections. Measured and estimated stay separate."],
              ].map(([n, title, body]) => (
                <li key={n} className="group grid grid-cols-[auto_1fr] items-baseline gap-4 border-b border-line-1 py-6 transition-[background-color] sm:grid-cols-[80px_1fr_2fr] sm:gap-6 md:py-7">
                  <span aria-hidden="true" className="tnum font-display text-5xl font-semibold tracking-tighter text-ink-3/40 transition-colors duration-200 ease-out group-hover:text-ink-1 md:text-6xl">
                    {n}
                  </span>
                  <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="measure col-start-2 max-w-prose text-sm leading-6 text-ink-2 sm:col-start-3">{body}</p>
                </li>
              ))}
            </ol>
            <ScrollReveal className="mt-10">
              <FactsBand />
            </ScrollReveal>
          </div>
        </section>

        {/* 05 — Features */}
        <section id="features" aria-labelledby="features-heading" className="relative overflow-hidden border-b border-line-1">
          <div aria-hidden="true" style={{ animationDelay: "-5s" }} className="be-beam pointer-events-none absolute inset-y-0 right-0 w-[36vw]" />
          <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <ScrollReveal>
              <Eyebrow index="05">What it does</Eyebrow>
              <h2 id="features-heading" className="mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tighter md:text-4xl">
                Observe first, optimize with evidence
              </h2>
            </ScrollReveal>
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-6">
              {FEATURES.map((f, i) => {
                const invert = i === 0;
                return (
                  <Spot
                    key={f.n}
                    className={[
                      "group relative overflow-hidden rounded-xl border p-6 transition-[transform,border-color] duration-200 ease-out hover:-translate-y-1 sm:p-7",
                      f.span,
                      invert
                        ? "border-transparent bg-accent text-accent-ink shadow-pop hover:border-transparent"
                        : "border-line-1 bg-card shadow-card hover:border-line-2",
                    ].join(" ")}
                  >
                    <span
                      aria-hidden="true"
                      className={[
                        "tnum pointer-events-none absolute -top-3 right-3 font-display text-7xl font-semibold tracking-tighter transition-colors duration-200 ease-out",
                        invert ? "text-accent-ink/[0.14]" : "text-ink-1/[0.07] group-hover:text-ink-1/[0.12]",
                      ].join(" ")}
                    >
                      {f.n}
                    </span>
                    <h3 className={`relative text-base font-semibold tracking-tight ${invert ? "text-accent-ink" : ""}`}>
                      {f.title}
                    </h3>
                    <p className={`relative mt-2 max-w-prose text-[13px] leading-6 ${invert ? "text-accent-ink/70" : "text-ink-2"}`}>
                      {f.body}
                    </p>
                    {f.code && (
                      <pre
                        className={[
                          "tnum relative mt-4 overflow-x-auto rounded-md border p-4 font-mono text-xs leading-6",
                          invert
                            ? "border-accent-ink/15 bg-accent-ink/[0.06] text-accent-ink"
                            : "border-line-1 bg-raise text-ink-1",
                        ].join(" ")}
                      >
                        {f.code}
                      </pre>
                    )}
                  </Spot>
                );
              })}
            </div>
          </div>
        </section>

        {/* 06 — Estimate */}
        <section id="estimate" aria-labelledby="estimate-heading" className="relative overflow-hidden border-b border-line-1">
          <div aria-hidden="true" style={{ animationDuration: "38s" }} className="be-grid-pan absolute inset-0 opacity-50" />
          <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <ScrollReveal>
              <Eyebrow index="06">Estimate</Eyebrow>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                <h2 id="estimate-heading" className="max-w-xl text-balance text-3xl font-semibold tracking-tighter md:text-4xl">
                  What would your traffic save?
                </h2>
                <p className="font-mono text-[11px] uppercase tracking-widest text-ink-3">your inputs · computed live</p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.08} className="mt-8">
              <SavingsCalculator />
            </ScrollReveal>
          </div>
        </section>

        {/* 07 — Integration */}
        <section id="integrate" aria-labelledby="integrate-heading" className="relative overflow-hidden border-b border-line-1 bg-raise/60">
          <div aria-hidden="true" style={{ animationDelay: "-7s" }} className="be-beam pointer-events-none absolute inset-y-0 right-0 w-[30vw]" />
          <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <ScrollReveal>
                  <Eyebrow index="07">Integration</Eyebrow>
                  <h2 id="integrate-heading" className="mt-3 text-balance text-3xl font-semibold tracking-tighter md:text-4xl">
                    Change one URL, keep your SDK
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-ink-2">
                    Same OpenAI-compatible payload. Swap the base URL for your gateway endpoint and send.
                  </p>
                  <p className="mt-4 font-mono text-[11px] leading-5 text-ink-3">
                    Create a key at /dashboard/keys, export it locally, never commit it.
                  </p>
                </ScrollReveal>
              </div>
              <ScrollReveal delay={0.08} className="lg:col-span-8">
                <SdkTabs />
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* 08 — FAQ */}
        <section id="faq" aria-labelledby="faq-heading" className="relative overflow-hidden border-b border-line-1">
          <div aria-hidden="true" style={{ animationDuration: "19s" }} className="be-scan pointer-events-none absolute inset-x-0 top-0 h-32" />
          <div className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 lg:py-20">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <ScrollReveal>
                  <Eyebrow index="08">Questions</Eyebrow>
                  <h2 id="faq-heading" className="mt-3 text-balance text-3xl font-semibold tracking-tighter md:text-4xl">
                    Asked before you ask
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-ink-2">
                    Straight answers from the documented behavior — no sales layer.
                  </p>
                </ScrollReveal>
              </div>
              <ScrollReveal delay={0.08} className="lg:col-span-8">
                <Faq />
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Close — statement band + wordmark */}
        <section aria-labelledby="cta-heading" className="overflow-x-clip">
          <div className="mx-auto max-w-6xl px-4 pb-10 pt-16 sm:px-6 lg:pt-24">
            <ScrollReveal>
              <div className="be-grain relative overflow-hidden rounded-3xl border border-line-1 bg-[#0A0A0A] px-6 py-14 text-[#FAFAFA] shadow-pop sm:px-10 lg:px-16 lg:py-20">
                <WebGLBackground variant="ink" />
                <div className="relative">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-60">
                    Begin in shadow
                  </p>
                  <h2 id="cta-heading" className="text-balance mt-4 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-tighter md:text-6xl">
                    Start in shadow mode. Change nothing until the rows convince you.
                  </h2>
                  <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                    <Magnetic>
                      <Link
                        href="/signup"
                        className="group inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#FAFAFA] px-7 text-base font-semibold text-[#0A0A0A] transition-[transform,opacity] hover:opacity-85 active:scale-[0.98]"
                      >
                        Start saving
                        <ArrowRight size={18} aria-hidden="true" className="transition-transform duration-200 ease-out group-hover:translate-x-1" />
                      </Link>
                    </Magnetic>
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-60">
                      OpenAI-compatible · Shadow by default
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
          <div aria-hidden="true" className="relative select-none px-2">
            <p className="wordmark whitespace-nowrap text-center font-display text-[19vw] font-bold leading-[0.85] tracking-tighter">
              BERRELEYE
            </p>
            <p aria-hidden="true" className="wordmark-sheen absolute inset-0 whitespace-nowrap px-2 text-center font-display text-[19vw] font-bold leading-[0.85] tracking-tighter">
              BERRELEYE
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
