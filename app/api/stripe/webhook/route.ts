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
      // One-time topup only (subscription credits handled by invoice.payment_succeeded)
      if (session.mode === "payment") {
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
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const priceId = sub.items.data[0]?.price.id;
      const tier = priceId
        ? (Object.entries({
            ...SUBSCRIPTION_PRICE_IDS,
            ...SUBSCRIPTION_YEARLY_PRICE_IDS,
          }).find(([, id]) => id === priceId)?.[0] ?? null)
        : null;

      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          subscriptionTier: tier,
          subscriptionStatus: sub.status === "active" ? "active" : sub.status,
          stripeSubscriptionId: sub.id,
          subscriptionPeriodEnd: new Date(sub.current_period_end * 1000),
        },
      });
      console.log(
        `Subscription ${event.type}: tier=${tier} status=${sub.status}`,
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
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription && invoice.amount_paid > 0) {
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
            description: "Monthly subscription top-up",
          });
          console.log(
            `Monthly credits added: ${invoice.amount_paid}¢ for user ${user.id}`,
          );
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
