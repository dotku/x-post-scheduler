import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getAccountLimit } from "@/lib/subscription";

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const [dbUser, accountCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionPeriodEnd: true,
      },
    }),
    prisma.xAccount.count({ where: { userId: user.id } }),
  ]);

  const tier = dbUser?.subscriptionTier ?? null;
  const status = dbUser?.subscriptionStatus ?? null;
  const accountLimit = getAccountLimit(tier);

  return NextResponse.json({
    tier,
    status,
    periodEnd: dbUser?.subscriptionPeriodEnd ?? null,
    accountLimit,
    accountCount,
  });
}
