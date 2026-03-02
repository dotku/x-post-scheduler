import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const body = await request.json();
    const clientName = (body.clientName ?? "").trim();
    const clientEmail = (body.clientEmail ?? "").trim() || null;
    const clientPhone = (body.clientPhone ?? "").trim() || null;
    const locale = body.locale ?? "en";

    if (!clientName) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!clientEmail && !clientPhone) {
      return NextResponse.json({ error: "Email or phone is required" }, { status: 400 });
    }
    if (clientEmail && !clientEmail.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { shareToken: token },
      select: { id: true, name: true, budgetCents: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (!campaign.budgetCents || campaign.budgetCents <= 0) {
      return NextResponse.json({ error: "No budget set for this campaign" }, { status: 400 });
    }

    // Check for existing paid payment
    const existingPayment = await prisma.campaignPayment.findUnique({
      where: { campaignId: campaign.id },
      select: { paymentStatus: true },
    });

    if (existingPayment?.paymentStatus === "paid") {
      return NextResponse.json({ error: "Campaign already paid" }, { status: 409 });
    }

    // Calculate fees
    const budgetCents = campaign.budgetCents;
    const platformFeeCents = Math.ceil(budgetCents * 0.05);
    const totalChargeCents = budgetCents + platformFeeCents;

    // Upsert payment record (replace any previous pending attempt)
    const payment = existingPayment
      ? await prisma.campaignPayment.update({
          where: { campaignId: campaign.id },
          data: {
            clientName,
            clientEmail,
            clientPhone,
            budgetCents,
            platformFeeCents,
            totalChargeCents,
            ownerPayoutCents: budgetCents,
            paymentStatus: "pending",
            stripeSessionId: null,
          },
        })
      : await prisma.campaignPayment.create({
          data: {
            campaignId: campaign.id,
            clientName,
            clientEmail,
            clientPhone,
            budgetCents,
            platformFeeCents,
            totalChargeCents,
            ownerPayoutCents: budgetCents,
          },
        });

    const prefix = locale === "zh" ? "/zh" : "";
    const baseUrl = APP_URL.replace(/\/$/, "");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      ...(clientEmail ? { customer_email: clientEmail } : {}),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `Campaign: ${campaign.name}` },
            unit_amount: budgetCents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Platform Service Fee (5%)" },
            unit_amount: platformFeeCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "campaign_payment",
        campaignPaymentId: payment.id,
        campaignId: campaign.id,
        shareToken: token,
        clientName,
        ...(clientEmail ? { clientEmail } : {}),
        ...(clientPhone ? { clientPhone } : {}),
      },
      success_url: `${baseUrl}${prefix}/campaigns/share/${token}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${prefix}/campaigns/share/${token}?payment=cancelled`,
    });

    // Store stripe session ID
    await prisma.campaignPayment.update({
      where: { id: payment.id },
      data: { stripeSessionId: session.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[campaigns/share/checkout] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create payment session" },
      { status: 500 }
    );
  }
}
