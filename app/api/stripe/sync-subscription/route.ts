import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import {
  stripe,
  SUBSCRIPTION_PRICE_IDS,
  SUBSCRIPTION_YEARLY_PRICE_IDS,
} from "@/lib/stripe";

export async function POST() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true },
    });

    if (!dbUser?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer found" },
        { status: 404 },
      );
    }

    // Fetch all subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: dbUser.stripeCustomerId,
      limit: 1,
      status: "all",
    });

    const activeSub = subscriptions.data.find((s) => s.status === "active");

    if (!activeSub) {
      // No active subscription - clear fields
      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionTier: null,
          subscriptionStatus: null,
          stripeSubscriptionId: null,
          subscriptionPeriodEnd: null,
        },
      });
      return NextResponse.json({
        tier: null,
        status: null,
        periodEnd: null,
      });
    }

    // Map price ID to tier
    const priceId = activeSub.items.data[0]?.price.id;
    const periodEnd = activeSub.items.data[0]?.current_period_end;

    // Create reverse mapping: price ID -> tier name
    const priceToTier: Record<string, string> = {};
    Object.entries(SUBSCRIPTION_PRICE_IDS).forEach(([tier, id]) => {
      if (id) priceToTier[id] = tier;
    });
    Object.entries(SUBSCRIPTION_YEARLY_PRICE_IDS).forEach(([tier, id]) => {
      if (id) priceToTier[id] = tier;
    });

    const tier = priceId ? (priceToTier[priceId] ?? null) : null;

    // Determine status: if cancel_at_period_end is true, mark as cancelled
    let status: string;
    if (activeSub.cancel_at_period_end) {
      status = "cancelled";
    } else if (activeSub.status === "active") {
      status = "active";
    } else {
      status = activeSub.status;
    }

    // Update database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: tier,
        subscriptionStatus: status,
        stripeSubscriptionId: activeSub.id,
        subscriptionPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      },
    });

    return NextResponse.json({
      tier,
      status,
      periodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    });
  } catch (error) {
    console.error("Sync subscription failed:", error);
    return NextResponse.json(
      { error: "Failed to sync subscription" },
      { status: 500 },
    );
  }
}
