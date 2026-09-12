import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { PLANS, priceIdFor, type BillingInterval } from "@/lib/plans";
import { getSiteUrl } from "@/lib/utils";

export const runtime = "nodejs";

/** POST { interval: "monthly" | "semester" | "yearly" } → { url } */
export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { interval } = (await request.json().catch(() => ({}))) as { interval?: BillingInterval };
  if (!interval || !(interval in PLANS)) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  const priceId = priceIdFor(interval);
  if (!priceId) return NextResponse.json({ error: `Price for ${interval} is not configured` }, { status: 500 });

  const stripe = getStripe();
  const site = getSiteUrl();

  // Reuse the Stripe customer so subscriptions stay attached to one record.
  let customerId = profile.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email ?? undefined,
      name: profile.full_name ?? undefined,
      metadata: { supabase_user_id: profile.id },
    });
    customerId = customer.id;
    const supabase = await createClient();
    await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", profile.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${site}/upgrade?success=1`,
    cancel_url: `${site}/upgrade?canceled=1`,
    client_reference_id: profile.id,
    subscription_data: { metadata: { supabase_user_id: profile.id } },
    metadata: { supabase_user_id: profile.id, interval },
  });

  return NextResponse.json({ url: session.url });
}
