import { stripe } from "../lib/stripe";
import { prisma } from "../lib/db";

async function main() {
  // Get the first user with a Stripe customer ID
  const user = await prisma.user.findFirst({
    where: {
      stripeCustomerId: { not: null },
    },
    select: {
      id: true,
      email: true,
      stripeCustomerId: true,
    },
  });

  if (!user?.stripeCustomerId) {
    console.log("No user with Stripe customer found");
    return;
  }

  console.log(`Processing user: ${user.email}`);
  console.log(`Stripe Customer: ${user.stripeCustomerId}\n`);

  // Fetch all active subscriptions
  const subscriptions = await stripe.subscriptions.list({
    customer: user.stripeCustomerId,
    status: "active",
    limit: 100,
  });

  console.log(`Found ${subscriptions.data.length} active subscriptions\n`);

  if (subscriptions.data.length <= 1) {
    console.log("Only one subscription, no cleanup needed");
    return;
  }

  // Sort by created date (keep the most recent)
  const sorted = subscriptions.data.sort((a, b) => b.created - a.created);
  const toKeep = sorted[0];
  const toCancel = sorted.slice(1);

  console.log(`✅ Keeping subscription: ${toKeep.id}`);
  console.log(`   Created: ${new Date(toKeep.created * 1000).toISOString()}`);
  console.log(`   Price: ${toKeep.items.data[0]?.price.id}\n`);

  console.log(`🗑️  Canceling ${toCancel.length} duplicate subscriptions:\n`);

  for (const sub of toCancel) {
    console.log(
      `   - ${sub.id} (created ${new Date(sub.created * 1000).toISOString()})`,
    );
    await stripe.subscriptions.cancel(sub.id);
    console.log(`     ✓ Cancelled`);
  }

  console.log(
    `\n✅ Cleanup complete! ${toCancel.length} subscriptions cancelled.`,
  );
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
