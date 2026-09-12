import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due"]);

/**
 * Stripe → Supabase plan sync.
 * Handles checkout completion and every subscription lifecycle change so the
 * `profiles.plan` column is always the source of truth for gating.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });

  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), sig, secret);
  } catch (err) {
    console.error("[stripe] bad signature", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription" || !session.subscription) break;
        const sub = await stripe.subscriptions.retrieve(
          typeof session.subscription === "string" ? session.subscription : session.subscription.id,
        );
        await applySubscription(sub, session.client_reference_id ?? session.metadata?.supabase_user_id ?? null);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed": {
        await applySubscription(event.data.object, null);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe] handler failed", event.type, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function applySubscription(sub: Stripe.Subscription, userIdHint: string | null) {
  const admin = createAdminClient();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Find the profile: by hint, by subscription metadata, then by customer id.
  let userId: string | null = userIdHint ?? sub.metadata?.supabase_user_id ?? null;
  if (!userId) {
    const { data } = await admin.from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle();
    userId = (data?.id as string | undefined) ?? null;
  }
  if (!userId) {
    console.warn("[stripe] no profile for customer", customerId);
    return;
  }

  const item = sub.items.data[0];
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null;
  const active = ACTIVE_STATUSES.has(sub.status);

  await admin
    .from("profiles")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      stripe_price_id: item?.price?.id ?? null,
      plan: active ? "paid" : "free",
      // Keep access until the paid period ends even if they cancel.
      plan_expires_at: active || sub.cancel_at_period_end ? periodEnd : null,
    })
    .eq("id", userId);
}
