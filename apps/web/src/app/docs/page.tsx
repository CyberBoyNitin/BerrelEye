/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Hash } from "@/components/icons";
import { CopyButton } from "./copy-button";

export const metadata: Metadata = { title: "Docs — BerrelEye" };

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const SECTIONS = [
  "quickstart",
  "auth",
  "chat",
  "streaming",
  "models",
  "routing",
  "caching",
  "errors",
  "ratelimits",
  "webhooks",
  "keys",
];

const CODE = "rounded-sm border border-line-1 bg-raise px-1 py-0.5 font-mono text-xs text-ink-1";
const DOCS_LINK = "text-ink-1 underline decoration-line-2 underline-offset-4 transition-colors hover:text-accent";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-line-1 py-10">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink-1">
        <a href={`#${id}`} aria-label={`Link to ${title}`} className="flex h-8 w-8 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-hover hover:text-accent">
          <Hash size={16} aria-hidden="true" />
        </a>
        {title}
      </h2>
      <div className="measure mt-3 space-y-3 text-[14px] leading-6 text-ink-2">{children}</div>
    </section>
  );
}

function Pre({ code }: { code: string }) {
  return (
    <div className="relative rounded-lg border border-line-1 bg-raise">
      <pre className="tnum overflow-x-auto p-4 pr-24 font-mono text-xs leading-5 text-ink-1">{code}</pre>
      <div className="absolute right-2 top-2"><CopyButton text={code} /></div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-paper font-display text-ink-1">
      <header className="sticky top-0 z-40 border-b border-line-1 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent font-mono text-sm font-bold text-accent-ink">B</span>
            <span className="text-sm font-semibold text-ink-1">BerrelEye</span>
            <span className="font-mono text-[11px] text-ink-3">/ docs</span>
          </Link>
          <div className="flex h-11 items-center gap-5 text-[13px]">
            <Link href="/dashboard/overview" className="text-ink-2 transition-colors hover:text-ink-1">Dashboard</Link>
            <Link href="/login" className="text-ink-2 transition-colors hover:text-ink-1">Sign in</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="be-rise py-10">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-3">Documentation</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-semibold leading-none tracking-tighter text-balance text-ink-1">Ship cheaper LLM traffic in an afternoon.</h1>
          <p className="measure mt-3 text-[14px] leading-6 text-ink-2">
            OpenAI-compatible gateway. Dashboard session auth uses a gateway cookie (credentials: include).
            Provider secrets never touch the browser.
          </p>
        </div>

        <div className="gap-10 pb-10 lg:grid lg:grid-cols-[200px_minmax(0,1fr)]">
          <nav aria-label="Docs sections" className="mb-2 lg:mb-0">
            <div className="flex gap-2 overflow-x-auto pb-4 lg:sticky lg:top-20 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
              {SECTIONS.map((s) => (
                <a key={s} href={`#${s}`} className="shrink-0 rounded-full border border-line-1 px-3 py-2 font-mono text-xs text-ink-2 transition-colors hover:border-line-2 hover:text-ink-1 lg:rounded-md lg:border-transparent lg:px-2.5">{s}</a>
              ))}
            </div>
          </nav>

          <div className="min-w-0">
            <Section id="quickstart" title="Quickstart">
              <ol className="list-decimal space-y-2 pl-5">
                <li>Create an account at <Link href="/signup" className={DOCS_LINK}>/signup</Link>, then create a gateway API key at <Link href="/dashboard/keys" className={DOCS_LINK}>/dashboard/keys</Link>.</li>
                <li>Point your OpenAI base URL at the gateway and send a request.</li>
                <li>Watch it land in <Link href="/dashboard/requests" className={DOCS_LINK}>/dashboard/requests</Link> with tokens, cost, and routing.</li>
              </ol>
              <Pre code={`export BERRELEYE_KEY="sk_live_xxx"\ncurl ${API}/v1/chat/completions \\\n  -H "Authorization: Bearer $BERRELEYE_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hello"}]}'`} />
            </Section>

            <Section id="auth" title="Authentication">
              <p><strong>Dashboard:</strong> email/password session cookie. Browser calls use <code className={CODE}>credentials: &quot;include&quot;</code> against <code className={CODE}>NEXT_PUBLIC_API_URL</code> (default {API}).</p>
              <Pre code={`# Sign up\ncurl -c cookies.txt -X POST ${API}/api/auth/signup \\\n  -H "Content-Type: application/json" \\\n  -d '{"email":"you@company.com","password":"…","org_name":"Acme"}'\n\n# Me (session cookie)\ncurl -b cookies.txt ${API}/api/auth/me`} />
              <p><strong>Gateway:</strong> per-request API keys via <code className={CODE}>Authorization: Bearer sk_live_…</code>. Only key prefix + hash are stored; the full secret shows once at creation.</p>
            </Section>

            <Section id="chat" title="Chat Completions">
              <p><code className={CODE}>POST /v1/chat/completions</code> — OpenAI-compatible JSON. Supports model, messages, temperature, max_tokens / max_completion_tokens, stop, response_format (where the provider supports it), and tools.</p>
              <Pre code={`curl ${API}/v1/chat/completions \\\n  -H "Authorization: Bearer $BERRELEYE_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "model": "auto",\n    "messages": [{"role": "user", "content": "Explain quantum computing simply."}],\n    "temperature": 0.2\n  }'`} />
              <p>Unsupported parameters are rejected or explained — never silently reinterpreted when that would change behavior.</p>
            </Section>

            <Section id="streaming" title="Streaming">
              <p>Pass <code className={CODE}>&quot;stream&quot;: true</code>. The gateway forwards provider chunks without buffering the full response. TTFT and total latency are recorded.</p>
              <Pre code={`curl -N ${API}/v1/chat/completions \\\n  -H "Authorization: Bearer $BERRELEYE_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "auto", "stream": true, "messages": [{"role": "user", "content": "Count to 5."}]}'`} />
            </Section>

            <Section id="models" title="Models">
              <p><code className={CODE}>GET /v1/models</code> lists enabled registry entries with model cost rates (per 1M tokens), context window, capabilities, and quality/latency tiers. Cost math: <code className={CODE}>input/1M × input_price + output/1M × output_price</code>. Missing provider usage is estimated and marked as estimated.</p>
              <Pre code={`curl ${API}/v1/models -H "Authorization: Bearer $BERRELEYE_KEY"`} />
            </Section>

            <Section id="routing" title="Routing">
              <p>Deterministic V1 router: SIMPLE → low-cost, CODING → coding-capable, REASONING → high-quality, STRUCTURED_OUTPUT → JSON-capable, TOOL_USE → tool-capable, UNKNOWN → default. Modes: OFF, SHADOW, RECOMMEND, AUTO. Configure at <Link href="/dashboard/settings" className={DOCS_LINK}>/dashboard/settings</Link>.</p>
              <Pre code={`# Shadow: nothing changes, analysis only\ncurl -X PUT ${API}/api/settings -b cookies.txt \\\n  -H "Content-Type: application/json" \\\n  -d '{"routing_policy": {"optimization_mode": "SHADOW"}}'`} />
            </Section>

            <Section id="caching" title="Caching">
              <p>Exact cache preferred; semantic cache is opt-in with a configurable threshold. Bypass per request with <code className={CODE}>X-AI-Cache: no-store</code>. Tool calls, transactions, and rapidly-changing private data default off.</p>
              <Pre code={`curl ${API}/v1/chat/completions \\\n  -H "Authorization: Bearer $BERRELEYE_KEY" \\\n  -H "X-AI-Cache: no-store" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "auto", "messages": [{"role": "user", "content": "Live balance?"}]}'`} />
            </Section>

            <Section id="errors" title="Errors">
              <p>Consistent shape. Production never leaks stack traces, provider secrets, or infra details.</p>
              <Pre code={`{\n  "error": {\n    "type": "provider_error",\n    "message": "The upstream provider is temporarily unavailable.",\n    "request_id": "req_xxx"\n  }\n}`} />
            </Section>

            <Section id="ratelimits" title="Rate limits">
              <p>Per organization, API key, IP, and provider (Redis-backed). Gateway returns <code className={CODE}>429</code> with <code className={CODE}>Retry-After</code>; retryable 429/5xx use exponential backoff with jitter. Auth failures and validation errors are never retried.</p>
            </Section>

            <Section id="webhooks" title="Webhooks">
              <p>V1 has no outbound webhooks. Budgets surface in the dashboard (80% warning, 90% alert, 100% configurable: BLOCK / DEGRADE_TO_CHEAPER_MODEL / ALERT_ONLY). Webhook abstraction is reserved for a later phase.</p>
            </Section>

            <Section id="keys" title="API keys">
              <p>Create and revoke keys at <Link href="/dashboard/keys" className={DOCS_LINK}>/dashboard/keys</Link>. Full secret appears once. Revoked keys are rejected immediately. Never commit keys; never put provider keys in browser code.</p>
              <Pre code={`curl ${API}/v1/chat/completions \\\n  -H "Authorization: Bearer sk_live_xxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hello"}]}'`} />
            </Section>

            <div className="py-10 text-center">
              <Link href="/signup" className="inline-flex h-11 items-center gap-1 font-mono text-sm text-ink-1 underline underline-offset-4 decoration-line-2 transition-colors hover:text-accent">Analyze My AI Spend <ArrowUpRight size={15} aria-hidden="true" /></Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
