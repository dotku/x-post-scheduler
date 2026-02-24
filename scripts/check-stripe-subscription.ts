import { stripe } from "../lib/stripe";
import { prisma } from "../lib/db";

async function main() {
  // Get the first user with a Stripe customer ID
  const users = await prisma.user.findMany({
    where: {
      stripeCustomerId: { not: null },
    },
    select: {
      id: true,
      email: true,
      stripeCustomerId: true,
      subscriptionTier: true,
      subscriptionStatus: true,
    },
  });

  console.log(`Found ${users.length} users with Stripe customers`);

  for (const user of users) {
    console.log(`\n--- User: ${user.email} ---`);
    console.log(`DB Tier: ${user.subscriptionTier ?? "none"}`);
    console.log(`DB Status: ${user.subscriptionStatus ?? "none"}`);

    if (user.stripeCustomerId) {
      console.log(`\nFetching from Stripe (${user.stripeCustomerId})...`);
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        limit: 10,
      });

      console.log(`Found ${subscriptions.data.length} subscriptions:`);
      subscriptions.data.forEach((sub, i) => {
        console.log(`\n  Subscription ${i + 1}:`);
        console.log(JSON.stringify(sub, null, 2));
      });
    }
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
