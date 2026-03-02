import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { prisma } from "@/lib/db";
import {
  getAvailableBalance,
  calculatePayoutFee,
  executePayout,
} from "@/lib/stripe-connect";

// GET: Payout history
export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  try {
    const payouts = await prisma.payout.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        amountCents: true,
        feeCents: true,
        netAmountCents: true,
        method: true,
        status: true,
        completedAt: true,
        failedReason: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ payouts });
  } catch (error) {
    console.error("[stripe/payout] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payouts" },
      { status: 500 }
    );
  }
}

// POST: Request a payout
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const method: "standard" | "instant" =
      body.method === "instant" ? "instant" : "standard";

    const { availableCents } = await getAvailableBalance(user.id);

    const amountCents = body.amountCents
      ? Math.min(body.amountCents, availableCents)
      : availableCents;

    if (amountCents <= 0) {
      return NextResponse.json(
        { error: "No available balance" },
        { status: 400 }
      );
    }

    if (amountCents < 100) {
      return NextResponse.json(
        { error: "Minimum payout is $1.00" },
        { status: 400 }
      );
    }

    const feeCents = calculatePayoutFee(amountCents, method);
    const netAmountCents = amountCents - feeCents;

    const result = await executePayout({ userId: user.id, amountCents, method });

    return NextResponse.json({
      success: true,
      payoutId: result.payoutId,
      amountCents,
      feeCents,
      netAmountCents,
      method,
    });
  } catch (error) {
    console.error("[stripe/payout] POST error:", error);
    const message = error instanceof Error ? error.message : "Payout failed";

    if (message === "CONNECT_NOT_ACTIVE") {
      return NextResponse.json(
        { error: "Stripe Connect account is not active" },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
