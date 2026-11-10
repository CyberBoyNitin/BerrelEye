/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
import * as React from "react";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "default" | "lg";
}

// Flagship primary = single accent pill. 44px targets on default/lg,
// visible accent focus ring, press scale per token contract.
export function Button({ variant = "default", size = "default", className, ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-display text-sm font-medium transition-[transform,background-color,color,border-color] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";
  const variants: Record<string, string> = {
    default: "bg-accent text-accent-ink hover:bg-accent-strong",
    secondary: "border border-line-1 bg-raise text-ink-1 hover:bg-hover",
    outline: "border border-line-2 bg-transparent text-ink-1 hover:bg-hover",
    ghost: "text-ink-2 hover:bg-hover hover:text-ink-1",
    destructive: "bg-danger text-white hover:brightness-110",
  };
  const sizes: Record<string, string> = {
    sm: "h-9 min-h-9 px-4 text-[13px]",
    default: "h-11 min-h-11 px-5",
    lg: "h-12 min-h-12 px-7 text-[15px]",
  };
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
