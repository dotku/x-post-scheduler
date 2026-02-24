import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json() as {
    email?: string;
    amountCents?: number;
    note?: string;
  };

  const { email, amountCents, note } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }
  if (!amountCents || typeof amountCents !== "number" || amountCents <= 0 || !Number.isInteger(amountCents)) {
    return NextResponse.json({ error: "amountCents must be a positive integer" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, creditBalanceCents: true },
  });

  if (!user) {
    return NextResponse.json({ error: `User not found: ${email}` }, { status: 404 });
  }

  const adminTopupId = `admin_topup_${randomUUID()}`;

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { creditBalanceCents: { increment: amountCents } },
    select: { creditBalanceCents: true },
  });

  await prisma.creditTransaction.create({
    data: {
      userId: user.id,
      type: "topup",
      amountCents,
      balanceAfter: updatedUser.creditBalanceCents,
      description: note
        ? `Admin top-up: ${note}`
        : `Admin top-up`,
      stripeSessionId: adminTopupId,
    },
  });

  return NextResponse.json({
    success: true,
    user: { email: user.email, previousBalance: user.creditBalanceCents },
    newBalance: updatedUser.creditBalanceCents,
    amountCents,
  });
}
