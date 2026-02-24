import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { TIER_ORDER } from "@/lib/subscription";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json()) as {
    email?: string;
    subscriptionTier?: string | null;
    subscriptionStatus?: string | null;
    subscriptionPeriodEnd?: string | null; // ISO 8601
    note?: string;
  };

  const {
    email,
    subscriptionTier,
    subscriptionStatus,
    subscriptionPeriodEnd,
    note,
  } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  // Validate tier if provided
  if (subscriptionTier !== undefined && subscriptionTier !== null) {
    if (!TIER_ORDER.includes(subscriptionTier as any)) {
      return NextResponse.json(
        {
          error: `Invalid tier: ${subscriptionTier}. Must be one of: ${TIER_ORDER.join(", ")}`,
        },
        { status: 400 },
      );
    }
  }

  // Validate status if provided
  if (subscriptionStatus !== undefined && subscriptionStatus !== null) {
    const validStatuses = ["active", "cancelled", "past_due"];
    if (!validStatuses.includes(subscriptionStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status: ${subscriptionStatus}. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 },
      );
    }
  }

  const user = await prisma.user.findFirst({
    where: { email: email.trim().toLowerCase() },
    select: {
      id: true,
      email: true,
      subscriptionTier: true,
      subscriptionStatus: true,
      subscriptionPeriodEnd: true,
      stripeSubscriptionId: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: `User not found: ${email}` },
      { status: 404 },
    );
  }

  // Build update data
  const updateData: Record<string, string | Date | null> = {};
  if (subscriptionTier !== undefined) {
    updateData.subscriptionTier = subscriptionTier;
  }
  if (subscriptionStatus !== undefined) {
    updateData.subscriptionStatus = subscriptionStatus;
  }
  if (subscriptionPeriodEnd !== undefined) {
    updateData.subscriptionPeriodEnd = subscriptionPeriodEnd
      ? new Date(subscriptionPeriodEnd)
      : null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
    select: {
      email: true,
      subscriptionTier: true,
      subscriptionStatus: true,
      subscriptionPeriodEnd: true,
    },
  });

  // Log the admin action as a credit transaction note (for audit trail)
  const description = note
    ? `Admin membership update: ${note}`
    : `Admin membership update`;

  await prisma.creditTransaction.create({
    data: {
      userId: user.id,
      type: "deduction", // neutral type, just for logging
      amountCents: 0,
      balanceAfter:
        (
          await prisma.user.findUnique({
            where: { id: user.id },
            select: { creditBalanceCents: true },
          })
        )?.creditBalanceCents ?? 0,
      description,
      stripeSessionId: `admin_membership_${Date.now()}`,
    },
  });

  return NextResponse.json({
    success: true,
    previous: {
      tier: user.subscriptionTier,
      status: user.subscriptionStatus,
      periodEnd: user.subscriptionPeriodEnd,
      stripeSubId: user.stripeSubscriptionId,
    },
    updated: updatedUser,
  });
}
