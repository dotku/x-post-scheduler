import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { addCredits } from "@/lib/credits";

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
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const amountCents = parseInt(session.metadata?.amountCents ?? "0", 10);

    if (userId && amountCents > 0) {
      await addCredits({
        userId,
        amountCents,
        stripeSessionId: session.id,
      });
      console.log(`Credits added: ${amountCents} cents for user ${userId}`);
    }
  }

  return NextResponse.json({ received: true });
}
