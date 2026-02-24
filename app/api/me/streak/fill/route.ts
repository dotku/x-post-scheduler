import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { deductFlatFee } from "@/lib/credits";
import { normalizeTier } from "@/lib/subscription";
import { startOfDay, subDays, addDays } from "date-fns";

const STREAK_FILL_COST_CENTS = 20; // $0.20

async function grantTemporaryMembership(
  userId: string,
  tier: string,
  days: number,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true, subscriptionStatus: true },
  });
  if (!user) return;
  if (
    user.subscriptionStatus === "active" &&
    normalizeTier(user.subscriptionTier) !== null
  ) {
    return;
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier: tier,
      subscriptionStatus: "active",
      subscriptionPeriodEnd: addDays(new Date(), days),
    },
  });
}

export async function POST() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      loginStreak: true,
      longestStreak: true,
      lastLoginDate: true,
      creditBalanceCents: true,
    },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const todayStart = startOfDay(new Date());
  const yesterdayStart = subDays(todayStart, 1);

  // Allow fill only when streak was reset today:
  // streak === 1 AND lastLoginDate >= todayStart (meaning checkin ran today and reset streak)
  const streakResetToday =
    dbUser.loginStreak === 1 &&
    dbUser.lastLoginDate !== null &&
    dbUser.lastLoginDate >= todayStart;

  if (!streakResetToday) {
    return NextResponse.json(
      { error: "No gap to fill — your streak is intact." },
      { status: 400 },
    );
  }

  // Check balance
  if (dbUser.creditBalanceCents < STREAK_FILL_COST_CENTS) {
    return NextResponse.json(
      { error: "Insufficient credits to fill streak gap." },
      { status: 402 },
    );
  }

  // Deduct $0.20 and restore yesterday as last login date
  await deductFlatFee({
    userId: user.id,
    feeCents: STREAK_FILL_COST_CENTS,
    source: "streak_fill",
  });

  const newStreak = dbUser.loginStreak + 1;
  const newLongest = Math.max(newStreak, dbUser.longestStreak);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginDate: yesterdayStart,
      loginStreak: newStreak,
      longestStreak: newLongest,
    },
    select: { creditBalanceCents: true },
  });

  // Check milestones after fill
  if (newStreak === 5) {
    await grantTemporaryMembership(user.id, "wood", 7);
  } else if (newStreak === 30) {
    await grantTemporaryMembership(user.id, "bronze", 30);
  }

  return NextResponse.json({
    filled: true,
    streak: newStreak,
    longestStreak: newLongest,
    costCents: STREAK_FILL_COST_CENTS,
    creditBalanceCents: updatedUser.creditBalanceCents,
    milestoneAt5: newStreak === 5,
    milestoneAt30: newStreak === 30,
  });
}
