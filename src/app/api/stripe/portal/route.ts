import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { getSiteUrl } from "@/lib/utils";

export const runtime = "nodejs";

/** Opens the Stripe billing portal so students can cancel / change plans themselves. */
export async function POST() {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!profile.stripe_customer_id) return NextResponse.json({ error: "No billing account yet" }, { status: 400 });

  const session = await getStripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${getSiteUrl()}/settings`,
  });
  return NextResponse.json({ url: session.url });
}
