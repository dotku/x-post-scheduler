import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  stripe,
  SUBSCRIPTION_PRICE_IDS,
  SUBSCRIPTION_YEARLY_PRICE_IDS,
} from "@/lib/stripe";
import { addCredits } from "@/lib/credits";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode === "payment") {
        // One-time topup
        const userId = session.metadata?.userId;
        const amountCents = parseInt(session.metadata?.amountCents ?? "0", 10);
        if (userId && amountCents > 0) {
          await addCredits({
            userId,
            amountCents,
            stripeSessionId: session.id,
          });
          console.log(`Credits added: ${amountCents}¢ for user ${userId}`);
        }
      } else if (session.mode === "subscription" && session.amount_total) {
        // Subscription - immediate credit on first purchase
        const userId = session.metadata?.userId;
        if (userId) {
          await addCredits({
            userId,
            amountCents: session.amount_total, // amount in cents
            stripeSessionId: session.id,
            description: "Initial subscription purchase",
          });
          console.log(
            `Initial subscription credits added: ${session.amount_total}¢ for user ${userId}`,
          );
        }
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const priceId = sub.items.data[0]?.price.id;
      const periodEnd = sub.items.data[0]?.current_period_end;

      // Create reverse mapping: price ID -> tier name
      const priceToTier: Record<string, string> = {};
      Object.entries(SUBSCRIPTION_PRICE_IDS).forEach(([tier, id]) => {
        if (id && tier !== "air") priceToTier[id] = tier;
      });
      Object.entries(SUBSCRIPTION_YEARLY_PRICE_IDS).forEach(([tier, id]) => {
        if (id && tier !== "air") priceToTier[id] = tier;
      });

      const tier = priceId ? (priceToTier[priceId] ?? null) : null;

      // Determine status: if cancel_at_period_end is true, mark as cancelled
      let status: string;
      if (sub.cancel_at_period_end) {
        status = "cancelled";
      } else if (sub.status === "active") {
        status = "active";
      } else {
        status = sub.status;
      }

      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          subscriptionTier: tier,
          subscriptionStatus: status,
          stripeSubscriptionId: sub.id,
          subscriptionPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        },
      });
      console.log(
        `Subscription ${event.type}: tier=${tier} status=${status} cancel_at_period_end=${sub.cancel_at_period_end}`,
      );
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          subscriptionTier: null,
          subscriptionStatus: "cancelled",
          stripeSubscriptionId: null,
          subscriptionPeriodEnd: null,
        },
      });
      console.log(`Subscription deleted for customer ${customerId}`);
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
      };
      // Only credit for recurring subscriptions (not initial subscription creation)
      // Initial subscription is handled by checkout.session.completed
      if (
        invoice.subscription &&
        invoice.amount_paid > 0 &&
        invoice.billing_reason === "subscription_cycle"
      ) {
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : (invoice.customer as Stripe.Customer)?.id;
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
          select: { id: true },
        });
        if (user) {
          await addCredits({
            userId: user.id,
            amountCents: invoice.amount_paid,
            stripeSessionId: invoice.id, // idempotency key
            description: "Subscription renewal top-up",
          });
          console.log(
            `Renewal credits added: ${invoice.amount_paid}¢ for user ${user.id}`,
          );
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
