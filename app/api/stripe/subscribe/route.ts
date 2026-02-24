import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import {
  stripe,
  SUBSCRIPTION_PRICE_IDS,
  SUBSCRIPTION_YEARLY_PRICE_IDS,
} from "@/lib/stripe";
import { TIER_ORDER } from "@/lib/subscription";
import type { TierKey } from "@/lib/subscription";

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  try {
    const { tier, interval } = (await request.json()) as {
      tier: string;
      interval?: "monthly" | "yearly";
    };

    if (!TIER_ORDER.includes(tier as TierKey)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const billingInterval = interval === "yearly" ? "yearly" : "monthly";
    const priceId =
      billingInterval === "yearly"
        ? SUBSCRIPTION_YEARLY_PRICE_IDS[tier]
        : SUBSCRIPTION_PRICE_IDS[tier];
    if (!priceId) {
      return NextResponse.json(
        { error: "Subscription not configured for this tier" },
        { status: 503 },
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        email: true,
      },
    });

    // Create Stripe customer if needed
    let customerId = dbUser?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: dbUser?.email ?? undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Check for existing active subscriptions
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 10,
    });

    if (existingSubscriptions.data.length > 0) {
      const activeSub = existingSubscriptions.data[0];

      // If the subscription is pending cancellation (cancel_at_period_end),
      // directly reactivate it via API — no redirect needed
      if (activeSub.cancel_at_period_end) {
        const currentPriceId = activeSub.items.data[0]?.price.id;

        if (currentPriceId === priceId) {
          // Same tier: reactivate in place
          await stripe.subscriptions.update(activeSub.id, {
            cancel_at_period_end: false,
          });
          await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: { subscriptionStatus: "active" },
          });
          return NextResponse.json({ reactivated: true });
        }

        // Different tier: update the subscription's price
        await stripe.subscriptions.update(activeSub.id, {
          cancel_at_period_end: false,
          items: [{ id: activeSub.items.data[0].id, price: priceId }],
          metadata: { userId: user.id, tier, interval: billingInterval },
          proration_behavior: "always_invoice",
        });
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { subscriptionTier: tier, subscriptionStatus: "active" },
        });
        return NextResponse.json({ reactivated: true });
      }

      // Truly active subscription (not cancelling) — send to billing portal to manage
      const origin =
        process.env.NEXT_PUBLIC_APP_LOCAL_URL ??
        process.env.APP_BASE_URL ??
        request.headers.get("origin") ??
        "http://localhost:3000";
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/settings?sub=success`,
      });
      return NextResponse.json({ url: portal.url, portal: true });
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_LOCAL_URL ??
      process.env.APP_BASE_URL ??
      request.headers.get("origin") ??
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings?sub=success`,
      cancel_url: `${origin}/settings`,
      metadata: { userId: user.id, tier, interval: billingInterval },
      subscription_data: {
        metadata: { userId: user.id, tier, interval: billingInterval },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe subscribe failed:", error);
    const message =
      process.env.NODE_ENV === "development"
        ? error instanceof Error
          ? error.message
          : "Unknown error"
        : "Subscription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
