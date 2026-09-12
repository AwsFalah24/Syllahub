"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-[0_1px_2px_rgba(74,38,168,0.2),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-brand/60",
  secondary: "bg-surface-2 text-ink hover:bg-surface-3 active:bg-line",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  outline: "border border-line-strong text-ink hover:bg-surface hover:border-ink-subtle",
  danger: "bg-danger-soft text-danger hover:bg-[#fbd9db]",
  link: "text-brand-600 hover:text-brand-700 underline-offset-4 hover:underline px-0 h-auto",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-caption gap-1.5 rounded-lg",
  md: "h-10 px-4 text-body gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium whitespace-nowrap select-none transition-all duration-200 ease-out disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});
