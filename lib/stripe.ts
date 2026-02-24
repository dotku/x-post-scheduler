import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const TOPUP_OPTIONS = [
  { amountCents: 500, label: "$5.00" },
  { amountCents: 1000, label: "$10.00" },
  { amountCents: 2500, label: "$25.00" },
] as const;

// Stripe Price IDs for subscription tiers (set in environment variables)
// Create recurring monthly prices in Stripe Dashboard and add the IDs here
export const SUBSCRIPTION_PRICE_IDS: Record<string, string | undefined> = {
  wood: process.env.STRIPE_PRICE_WOOD,
  // Legacy alias: existing "air" subscribers map to wood price
  air: process.env.STRIPE_PRICE_WOOD,
  bronze: process.env.STRIPE_PRICE_BRONZE,
  iron: process.env.STRIPE_PRICE_IRON,
  silver: process.env.STRIPE_PRICE_SILVER,
  gold: process.env.STRIPE_PRICE_GOLD,
};

export const SUBSCRIPTION_YEARLY_PRICE_IDS: Record<string, string | undefined> =
  {
    wood: process.env.STRIPE_PRICE_WOOD_YEARLY,
    // Legacy alias: existing "air" subscribers map to wood yearly price
    air: process.env.STRIPE_PRICE_WOOD_YEARLY,
    bronze: process.env.STRIPE_PRICE_BRONZE_YEARLY,
    iron: process.env.STRIPE_PRICE_IRON_YEARLY,
    silver: process.env.STRIPE_PRICE_SILVER_YEARLY,
    gold: process.env.STRIPE_PRICE_GOLD_YEARLY,
  };
