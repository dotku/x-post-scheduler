import fs from "node:fs";
import path from "node:path";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error("Missing STRIPE_SECRET_KEY in environment.");
  process.exit(1);
}

type TierConfig = {
  name: string;
  monthlyCents: number;
  yearlyCents: number;
};

const TIERS: Record<string, TierConfig> = {
  air: { name: "Air", monthlyCents: 100, yearlyCents: 1000 },
  bronze: { name: "Bronze", monthlyCents: 300, yearlyCents: 3000 },
  iron: { name: "Iron", monthlyCents: 500, yearlyCents: 5000 },
  silver: { name: "Silver", monthlyCents: 1000, yearlyCents: 10000 },
  gold: { name: "Gold", monthlyCents: 10000, yearlyCents: 99900 },
};

const STRIPE_API = "https://api.stripe.com/v1";

async function stripePost(endpoint: string, body: Record<string, string>) {
  const form = new URLSearchParams(body);
  const res = await fetch(`${STRIPE_API}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Stripe API error ${res.status}: ${errorText}`);
  }

  return (await res.json()) as { id: string };
}

async function createProduct(name: string, tier: string) {
  return stripePost("/products", {
    name: `${name} Membership`,
    "metadata[tier]": tier,
  });
}

async function createPrice(params: {
  productId: string;
  amountCents: number;
  interval: "month" | "year";
  nickname: string;
  tier: string;
}) {
  return stripePost("/prices", {
    product: params.productId,
    unit_amount: String(params.amountCents),
    currency: "usd",
    "recurring[interval]": params.interval,
    nickname: params.nickname,
    "metadata[tier]": params.tier,
    "metadata[interval]": params.interval === "year" ? "yearly" : "monthly",
  });
}

function updateEnvFile(priceIds: Record<string, string>, envPath: string) {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  let next = raw;
  for (const [key, value] of Object.entries(priceIds)) {
    const line = `${key}="${value}"`;
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(next)) {
      next = next.replace(regex, line);
    } else {
      next += `\n${line}`;
    }
  }
  fs.writeFileSync(envPath, next, "utf8");
}

async function main() {
  const priceIds: Record<string, string> = {};

  for (const [tierKey, tier] of Object.entries(TIERS)) {
    const product = await createProduct(tier.name, tierKey);
    const monthly = await createPrice({
      productId: product.id,
      amountCents: tier.monthlyCents,
      interval: "month",
      nickname: `${tier.name} Monthly`,
      tier: tierKey,
    });
    const yearly = await createPrice({
      productId: product.id,
      amountCents: tier.yearlyCents,
      interval: "year",
      nickname: `${tier.name} Yearly`,
      tier: tierKey,
    });

    priceIds[`STRIPE_PRICE_${tierKey.toUpperCase()}`] = monthly.id;
    priceIds[`STRIPE_PRICE_${tierKey.toUpperCase()}_YEARLY`] = yearly.id;
  }

  const envPath = path.resolve(process.cwd(), ".env.local");
  updateEnvFile(priceIds, envPath);

  console.log("Created Stripe prices:");
  for (const [key, value] of Object.entries(priceIds)) {
    console.log(`${key}=${value}`);
  }
  console.log(`Updated ${envPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
