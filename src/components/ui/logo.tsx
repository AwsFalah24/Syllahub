import { cn } from "@/lib/utils";

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 shadow-brand/40">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" aria-hidden>
          <path
            d="M6 5.5A1.5 1.5 0 0 1 7.5 4h7.379a1.5 1.5 0 0 1 1.06.44l2.622 2.62a1.5 1.5 0 0 1 .439 1.061V18.5A1.5 1.5 0 0 1 17.5 20h-10A1.5 1.5 0 0 1 6 18.5v-13Z"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path d="M9 12h6M9 15.5h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </span>
      {withText ? <span className="text-[17px] font-semibold tracking-tight text-ink">SyllaHub</span> : null}
    </span>
  );
}
