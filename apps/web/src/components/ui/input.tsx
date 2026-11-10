/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V5 */
import * as React from "react";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

// Flagship input: sunken raise surface, hairline border, 44px target,
// accent focus ring. Numeric inputs get tabular figures via tnum.
export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "flex h-11 min-h-11 w-full rounded-md border border-line-1 bg-raise px-4 py-2 font-display text-sm text-ink-1 tnum transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-ink-3 hover:border-line-2 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-ink-2", className)} {...props} />;
}

export function FieldError({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1.5 text-[13px] leading-5 text-danger", className)} {...props} />;
}
