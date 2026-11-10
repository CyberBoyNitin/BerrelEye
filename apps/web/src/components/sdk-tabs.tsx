/* SdkTabs — integrate-in-your-stack switcher. Real working snippets:
 * cURL, Python (openai SDK), Node.js (openai SDK), Docker Compose.
 * One base-URL swap — no vendor lock-in story to invent.
 */
"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { CopyButton } from "@/app/docs/copy-button";

const CURL = `curl http://localhost:8080/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hello"}]}'`;

const PYTHON = `from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="YOUR_KEY",  # gateway key, not a provider key
)

resp = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Hello"}],
)`;

const NODE = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:8080/v1",
  apiKey: "YOUR_KEY", // gateway key, not a provider key
});

const resp = await client.chat.completions.create({
  model: "auto",
  messages: [{ role: "user", content: "Hello" }],
});`;

const DOCKER = `cp .env.example .env
# set ENCRYPTION_KEY (openssl rand -base64 32) in .env
docker compose up --build

# gateway → http://localhost:8080
# dashboard → http://localhost:3000`;

const TABS = [
  { id: "curl", label: "cURL", code: CURL, file: "request.sh" },
  { id: "python", label: "Python", code: PYTHON, file: "quickstart.py" },
  { id: "node", label: "Node.js", code: NODE, file: "quickstart.mjs" },
  { id: "docker", label: "Docker", code: DOCKER, file: "self-host" },
] as const;

export function SdkTabs() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("curl");
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="overflow-hidden rounded-xl border border-line-1 bg-card shadow-card">
      <div
        role="tablist"
        aria-label="Integration snippets"
        className="flex items-center gap-1 overflow-x-auto border-b border-line-1 bg-raise px-2 pt-2 no-scrollbar"
      >
        {TABS.map((t) => {
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(t.id)}
              className={[
                "relative min-h-[44px] whitespace-nowrap rounded-t-md px-4 font-mono text-xs font-medium transition-colors duration-150 ease-out",
                selected ? "text-ink-1" : "text-ink-3 hover:text-ink-1",
              ].join(" ")}
            >
              {selected ? (
                <motion.span
                  layoutId={`sdk-tab-${id}`}
                  transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
                  className="absolute inset-0 rounded-t-md border border-b-0 border-line-1 bg-card"
                  aria-hidden="true"
                />
              ) : null}
              <span className="relative">{t.label}</span>
            </button>
          );
        })}
        <span className="tnum ml-auto hidden shrink-0 px-3 font-mono text-[11px] text-ink-3 sm:inline">
          {active.file}
        </span>
      </div>
      <div className="relative">
        <div className="absolute right-3 top-3 z-10">
          <CopyButton text={active.code} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.pre
            key={active.id}
            role="tabpanel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="tnum overflow-x-auto p-5 pr-16 font-mono text-xs leading-7 text-ink-1 sm:p-6 sm:pr-16"
          >
            {active.code}
          </motion.pre>
        </AnimatePresence>
      </div>
    </div>
  );
}
