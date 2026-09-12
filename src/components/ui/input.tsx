import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-line bg-bg px-3.5 text-body text-ink placeholder:text-ink-subtle transition-all duration-200 outline-none",
          "hover:border-line-strong focus:border-brand-400 focus:ring-4 focus:ring-brand-100",
          "disabled:bg-surface disabled:text-ink-muted",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-24 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-body text-ink placeholder:text-ink-subtle transition-all duration-200 outline-none resize-y",
          "hover:border-line-strong focus:border-brand-400 focus:ring-4 focus:ring-brand-100",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-caption font-medium text-ink-2 mb-1.5", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-11 w-full appearance-none rounded-xl border border-line bg-bg pl-3.5 pr-9 text-body text-ink transition-all duration-200 outline-none",
          "hover:border-line-strong focus:border-brand-400 focus:ring-4 focus:ring-brand-100",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden
      >
        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
