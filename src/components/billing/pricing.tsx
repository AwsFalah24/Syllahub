"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { BillingInterval } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface PriceCard {
  interval: BillingInterval;
  label: string;
  blurb: string;
  periodLabel: string;
  badge?: string;
  /** Formatted, e.g. "$4.99". Null when the price isn't configured yet. */
  amount: string | null;
  /** Per-month equivalent for comparison, e.g. "$3.33/mo". */
  perMonth: string | null;
  configured: boolean;
}

const FEATURES = [
  "Unlimited courses",
  "AI syllabus parsing for every class",
  "Grade tracker + what-do-I-need calculator",
  "Push & email reminders",
  "Weekly study plan",
  "Calendar subscription (Google / Apple)",
];

export function Pricing({ cards, isPaid }: { cards: PriceCard[]; isPaid: boolean }) {
  const [loading, setLoading] = useState<BillingInterval | null>(null);

  async function checkout(interval: BillingInterval) {
    setLoading(interval);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error ?? "Could not start checkout");
      window.location.assign(json.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start checkout");
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => {
          const featured = !!c.badge;
          return (
            <div
              key={c.interval}
              className={cn(
                "relative flex flex-col rounded-2xl p-6 transition-all",
                featured ? "bg-ink text-white shadow-lift" : "card-soft",
              )}
            >
              {c.badge ? (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1 text-micro font-semibold uppercase tracking-wider text-white shadow-brand">
                  <Sparkles className="h-3 w-3" /> {c.badge}
                </span>
              ) : null}
              <div className={cn("text-caption font-semibold uppercase tracking-wider", featured ? "text-brand-200" : "text-ink-muted")}>
                {c.label}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-[34px] font-semibold leading-none tracking-tight tabular">{c.amount ?? "TBD"}</span>
                <span className={cn("text-caption", featured ? "text-white/60" : "text-ink-muted")}>{c.periodLabel}</span>
              </div>
              <p className={cn("mt-1 min-h-5 text-caption", featured ? "text-white/60" : "text-ink-muted")}>
                {c.perMonth ? `≈ ${c.perMonth}` : c.blurb}
              </p>
              <Button
                className={cn("mt-6 w-full", featured && "bg-white text-ink hover:bg-brand-50 shadow-none")}
                variant={featured ? "secondary" : "primary"}
                size="lg"
                disabled={!c.configured || isPaid}
                loading={loading === c.interval}
                onClick={() => checkout(c.interval)}
              >
                {isPaid ? "Current plan" : c.configured ? `Choose ${c.label.toLowerCase()}` : "Coming soon"}
              </Button>
            </div>
          );
        })}
      </div>

      <ul className="mx-auto mt-10 grid max-w-2xl gap-2.5 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-2 text-body text-ink-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
