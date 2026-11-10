/* ThemeToggle — flagship segmented light/dark control. Sliding ink
 * indicator (motion layoutId), 44px targets, persisted by next-themes.
 */
"use client";

import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useId, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-[40px] w-[76px] items-center rounded-full border border-line-1 bg-raise"
      />
    );
  }

  const dark = theme === "dark";
  const options = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
  ] as const;

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="inline-flex h-[40px] items-center rounded-full border border-line-1 bg-raise p-1"
    >
      {options.map(({ value, label, Icon }) => {
        const selected = dark ? value === "dark" : value === "light";
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={selected}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            className={[
              "relative inline-flex h-8 w-8 items-center justify-center rounded-full transition-[transform,color] duration-150 ease-out active:scale-[0.92]",
              selected ? "text-accent-ink" : "text-ink-3 hover:text-ink-1",
            ].join(" ")}
          >
            {selected ? (
              <motion.span
                layoutId={`theme-toggle-ink-${id}`}
                transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
                className="absolute inset-0 rounded-full bg-accent"
                aria-hidden="true"
              />
            ) : null}
            <Icon size={15} weight="bold" aria-hidden="true" className="relative" />
          </button>
        );
      })}
    </div>
  );
}
