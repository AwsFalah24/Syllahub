import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getProfile } from "@/lib/supabase/server";
import { FREE_COURSE_LIMIT, isPaid, PLANS, priceIdFor, type BillingInterval } from "@/lib/plans";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { PageHeader } from "@/components/shell/page-header";
import { Pricing, type PriceCard } from "@/components/billing/pricing";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Upgrade" };

const INTERVAL_MONTHS: Record<BillingInterval, number> = { monthly: 1, semester: 4, yearly: 12 };

export default async function UpgradePage({ searchParams }: PageProps<"/upgrade">) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const sp = await searchParams;
  const paid = isPaid(profile);

  const cards = await Promise.all(
    (Object.keys(PLANS) as BillingInterval[]).map(async (interval): Promise<PriceCard> => {
      const plan = PLANS[interval];
      const priceId = priceIdFor(interval);
      let amount: string | null = null;
      let perMonth: string | null = null;
      if (priceId && stripeConfigured()) {
        try {
          const price = await getStripe().prices.retrieve(priceId);
          if (price.unit_amount != null) {
            const fmt = new Intl.NumberFormat("en", { style: "currency", currency: price.currency.toUpperCase() });
            amount = fmt.format(price.unit_amount / 100);
            perMonth = interval === "monthly" ? null : `${fmt.format(price.unit_amount / 100 / INTERVAL_MONTHS[interval])}/mo`;
          }
        } catch (err) {
          console.warn("[upgrade] could not load price", interval, err);
        }
      }
      return {
        interval,
        label: plan.label,
        blurb: plan.blurb,
        periodLabel: plan.periodLabel,
        badge: plan.badge,
        amount,
        perMonth,
        configured: Boolean(priceId && stripeConfigured()),
      };
    }),
  );

  return (
    <div className="mx-auto max-w-4xl">
      {sp.success ? (
        <div className="mb-8 flex items-center gap-3 rounded-2xl bg-success-soft px-4 py-3.5 text-body text-success">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">You&apos;re upgraded.</p>
            <p className="text-caption">It can take a few seconds for your plan to update. Add as many courses as you like.</p>
          </div>
          <Link href="/courses/new" className="ml-auto">
            <Button size="sm">Add a course</Button>
          </Link>
        </div>
      ) : null}

      <PageHeader
        eyebrow={sp.reason === "course_limit" ? "You've hit the free limit" : "Plans"}
        title={paid ? "You're on the paid plan" : "Track every course, not just one"}
        description={
          paid
            ? "Thanks for supporting SyllaHub. Manage or cancel your subscription any time from settings."
            : `The free plan covers ${FREE_COURSE_LIMIT} active course. Go paid to add your whole semester — and keep everything in one timeline.`
        }
      />

      <Pricing cards={cards} isPaid={paid} />

      <p className="mt-10 text-center text-caption text-ink-subtle">
        Prices shown are set in Stripe. Cancel any time — you keep access until the end of the period you paid for.
      </p>
    </div>
  );
}
