import {
  SUBSCRIPTION_PRICE_IDS,
  SUBSCRIPTION_YEARLY_PRICE_IDS,
} from "../lib/stripe";

const priceId = "price_1T48IsQQDFMviZa0paHilUK7"; // Gold monthly from your subscription

console.log("Testing FIXED price ID mapping...\n");
console.log("Price ID to find:", priceId);
console.log("\nMonthly Price IDs:", SUBSCRIPTION_PRICE_IDS);
console.log("\nYearly Price IDs:", SUBSCRIPTION_YEARLY_PRICE_IDS);

// Create reverse mapping: price ID -> tier name
const priceToTier: Record<string, string> = {};
Object.entries(SUBSCRIPTION_PRICE_IDS).forEach(([tier, id]) => {
  if (id) priceToTier[id] = tier;
});
Object.entries(SUBSCRIPTION_YEARLY_PRICE_IDS).forEach(([tier, id]) => {
  if (id) priceToTier[id] = tier;
});

console.log("\nPrice to Tier mapping:", priceToTier);

const tier = priceId ? (priceToTier[priceId] ?? null) : null;
console.log("\nFinal tier result:", tier);
console.log(tier === "gold" ? "✅ SUCCESS!" : "❌ FAILED");
