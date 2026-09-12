import type { Profile } from "@/lib/types";

export const FREE_COURSE_LIMIT = 1;

export function isPaid(profile: Pick<Profile, "plan" | "plan_expires_at">) {
  if (profile.plan !== "paid") return false;
  if (!profile.plan_expires_at) return true;
  // Small grace period so a webhook delay doesn't lock someone out.
  const graceMs = 3 * 24 * 60 * 60 * 1000;
  return new Date(profile.plan_expires_at).getTime() + graceMs > Date.now();
}

export function courseLimitFor(profile: Pick<Profile, "plan" | "plan_expires_at">) {
  return isPaid(profile) ? Infinity : FREE_COURSE_LIMIT;
}

export function canAddCourse(profile: Pick<Profile, "plan" | "plan_expires_at">, activeCourseCount: number) {
  return activeCourseCount < courseLimitFor(profile);
}

export type BillingInterval = "monthly" | "semester" | "yearly";

export const PLANS: Record<
  BillingInterval,
  { label: string; blurb: string; priceEnv: string; badge?: string; periodLabel: string }
> = {
  monthly: {
    label: "Monthly",
    blurb: "Cancel any time.",
    priceEnv: "STRIPE_PRICE_MONTHLY",
    periodLabel: "/ month",
  },
  semester: {
    label: "Semester",
    blurb: "Billed every 4 months — one semester at a time.",
    priceEnv: "STRIPE_PRICE_SEMESTER",
    badge: "Most popular",
    periodLabel: "/ 4 months",
  },
  yearly: {
    label: "Yearly",
    blurb: "Best value for a full academic year.",
    priceEnv: "STRIPE_PRICE_YEARLY",
    periodLabel: "/ year",
  },
};

export function priceIdFor(interval: BillingInterval) {
  return process.env[PLANS[interval].priceEnv] ?? null;
}
