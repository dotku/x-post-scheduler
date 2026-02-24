import { stripe } from "../lib/stripe";
import { prisma } from "../lib/db";
import { addCredits } from "../lib/credits";

async function main() {
  // Get the user with Stripe customer
  const user = await prisma.user.findFirst({
    where: {
      stripeCustomerId: { not: null },
      stripeSubscriptionId: { not: null },
    },
    select: {
      id: true,
      email: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });

  if (!user) {
    console.log("No user with active subscription found");
    return;
  }

  console.log(`Processing user: ${user.email}`);
  console.log(`Subscription ID: ${user.stripeSubscriptionId}\n`);

  // Get the subscription details
  const subscription = await stripe.subscriptions.retrieve(
    user.stripeSubscriptionId!,
  );

  const priceId = subscription.items.data[0]?.price.id;
  const amount = subscription.items.data[0]?.price.unit_amount; // in cents

  if (!amount) {
    console.log("No amount found on subscription");
    return;
  }

  console.log(`Price ID: ${priceId}`);
  console.log(`Amount: $${amount / 100} (${amount} cents)\n`);

  // Check if already credited
  const existingCredits = await prisma.creditTransaction.findMany({
    where: {
      userId: user.id,
      description: "Manual subscription credit backfill",
    },
  });

  if (existingCredits.length > 0) {
    console.log("⚠️  Already credited. Existing transactions:");
    existingCredits.forEach((txn) => {
      console.log(`  - ${txn.amountCents}¢ on ${txn.createdAt}`);
    });
    console.log("\nSkipping credit to avoid duplicate.");
    return;
  }

  // Add credits
  await addCredits({
    userId: user.id,
    amountCents: amount,
    stripeSessionId: `backfill-${subscription.id}`,
    description: "Manual subscription credit backfill",
  });

  console.log(
    `✅ Credits added: ${amount}¢ ($${amount / 100}) for user ${user.email}`,
  );

  // Verify balance
  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { creditBalanceCents: true },
  });

  console.log(
    `\nCurrent balance: ${updatedUser?.creditBalanceCents}¢ ($${(updatedUser?.creditBalanceCents ?? 0) / 100})`,
  );
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
