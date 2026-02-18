import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const TOPUP_OPTIONS = [
  { amountCents: 500, label: "$5.00" },
  { amountCents: 1000, label: "$10.00" },
  { amountCents: 2500, label: "$25.00" },
] as const;
