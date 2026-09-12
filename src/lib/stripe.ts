import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not configured");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY, { typescript: true });
  return client;
}

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
