import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { stripe } from "@/lib/stripe";

export async function POST() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { stripeSubscriptionId: true, subscriptionPeriodEnd: true },
  });

  if (!dbUser?.stripeSubscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  const sub = await stripe.subscriptions.update(dbUser.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: "cancelled" },
  });

  return NextResponse.json({
    success: true,
    periodEnd: new Date(sub.current_period_end * 1000).toISOString(),
  });
}
