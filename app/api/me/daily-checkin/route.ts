import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { normalizeTier } from "@/lib/subscription";
import { startOfDay, subDays, addDays } from "date-fns";

/** Grant a temporary membership tier if the user doesn't already have an active paid subscription. */
async function grantTemporaryMembership(
  userId: string,
  tier: string,
  days: number,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true, subscriptionStatus: true, subscriptionPeriodEnd: true },
  });
  if (!user) return;

  // Don't overwrite an active paid subscription
  if (
    user.subscriptionStatus === "active" &&
    normalizeTier(user.subscriptionTier) !== null
  ) {
    return;
  }

  const periodEnd = addDays(new Date(), days);
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier: tier,
      subscriptionStatus: "active",
      subscriptionPeriodEnd: periodEnd,
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
      lastLoginRewardAt: true,
      creditBalanceCents: true,
    },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = subDays(todayStart, 1);

  // Already claimed today's reward — return current state without changes
  if (
    dbUser.lastLoginRewardAt &&
    dbUser.lastLoginRewardAt >= todayStart
  ) {
    return NextResponse.json({
      alreadyClaimed: true,
      streak: dbUser.loginStreak,
      longestStreak: dbUser.longestStreak,
      creditBalanceCents: dbUser.creditBalanceCents,
    });
  }

  // Calculate new streak
  let newStreak: number;
  // streakReset=true means the streak was broken and reset to 1 today (eligible for fill)
  let streakReset = false;
  if (
    dbUser.lastLoginDate &&
    dbUser.lastLoginDate >= yesterdayStart &&
    dbUser.lastLoginDate < todayStart
  ) {
    // Logged in yesterday → streak continues
    newStreak = dbUser.loginStreak + 1;
  } else if (dbUser.lastLoginDate && dbUser.lastLoginDate >= todayStart) {
    // Already logged in today (but reward not yet claimed) → keep streak
    newStreak = dbUser.loginStreak;
  } else {
    // Gap of >1 day → reset streak
    newStreak = 1;
    streakReset = dbUser.loginStreak > 1;
  }

  const newLongest = Math.max(newStreak, dbUser.longestStreak);
  const DAILY_REWARD_CENTS = 10; // $0.10

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      creditBalanceCents: { increment: DAILY_REWARD_CENTS },
      lastLoginRewardAt: now,
      lastLoginDate: now,
      loginStreak: newStreak,
      longestStreak: newLongest,
    },
    select: { creditBalanceCents: true },
  });

  await prisma.creditTransaction.create({
    data: {
      userId: user.id,
      type: "topup",
      amountCents: DAILY_REWARD_CENTS,
      balanceAfter: updatedUser.creditBalanceCents,
      description: "Daily login reward",
    },
  });

  // Milestone rewards (only grant at exact milestone, not repeatedly)
  if (newStreak === 5) {
    await grantTemporaryMembership(user.id, "wood", 7);
  } else if (newStreak === 30) {
    await grantTemporaryMembership(user.id, "bronze", 30);
  }

  return NextResponse.json({
    rewarded: true,
    streak: newStreak,
    longestStreak: newLongest,
    creditDelta: DAILY_REWARD_CENTS,
    creditBalanceCents: updatedUser.creditBalanceCents,
    streakReset,
    milestoneAt5: newStreak === 5,
    milestoneAt30: newStreak === 30,
  });
}
