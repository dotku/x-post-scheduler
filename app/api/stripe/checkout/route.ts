import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { stripe, TOPUP_OPTIONS } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { amountCents } = await request.json();
  const option = TOPUP_OPTIONS.find((o) => o.amountCents === amountCents);
  if (!option) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `Credit Top-up ${option.label}` },
          unit_amount: option.amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: user.id,
      amountCents: String(option.amountCents),
    },
    client_reference_id: user.id,
    success_url: `${appUrl}/settings?topup=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/settings?topup=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
