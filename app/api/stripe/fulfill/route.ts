import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { stripe } from "@/lib/stripe";
import { addCredits } from "@/lib/credits";

/**
 * POST /api/stripe/fulfill
 * Called after redirect from Stripe Checkout to fulfill the session.
 * Works as a fallback when webhooks aren't configured (e.g. local dev).
 * Idempotent — safe to call even if the webhook already processed the session.
 */
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json().catch(() => null);
    const sessionId = body?.sessionId as string | undefined;
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed yet", retryable: true },
        { status: 409 }
      );
    }

    const checkoutUserId = session.metadata?.userId ?? session.client_reference_id;
    if (checkoutUserId && checkoutUserId !== user.id) {
      return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
    }

    const metadataAmount = parseInt(session.metadata?.amountCents ?? "", 10);
    const amountCents =
      Number.isFinite(metadataAmount) && metadataAmount > 0
        ? metadataAmount
        : (session.amount_total ?? 0);

    if (amountCents <= 0) {
      return NextResponse.json({ error: "Invalid session amount" }, { status: 400 });
    }

    await addCredits({
      userId: user.id,
      amountCents,
      stripeSessionId: session.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message || "Stripe request failed" },
        { status: 400 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Stripe fulfill prisma error:", {
        code: error.code,
        message: error.message,
        meta: error.meta,
      });
      return NextResponse.json(
        {
          error:
            process.env.NODE_ENV === "development"
              ? `Database error (${error.code})`
              : "Database fulfillment error",
        },
        { status: 500 }
      );
    }

    console.error("Stripe fulfill failed:", error);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Internal fulfillment error: ${
                error instanceof Error ? error.message : String(error)
              }`
            : "Internal fulfillment error",
      },
      { status: 500 }
    );
  }
}
