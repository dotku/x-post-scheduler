import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { creditBalanceCents: true },
  });

  const recentTransactions = await prisma.creditTransaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      type: true,
      amountCents: true,
      balanceAfter: true,
      description: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    balanceCents: dbUser?.creditBalanceCents ?? 0,
    transactions: recentTransactions,
  });
}
