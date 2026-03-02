import { stripe } from "./stripe";
import { prisma } from "./db";

const INSTANT_PAYOUT_FEE_RATE = 0.015; // 1.5%

/**
 * Get or create a Stripe Connect Express account for a user.
 */
export async function getOrCreateConnectAccount(
  userId: string,
  email?: string | null
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeConnectAccountId: true, email: true },
  });

  if (user?.stripeConnectAccountId) {
    return user.stripeConnectAccountId;
  }

  const account = await stripe.accounts.create({
    type: "express",
    email: email ?? user?.email ?? undefined,
    metadata: { userId },
    capabilities: {
      transfers: { requested: true },
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeConnectAccountId: account.id,
      stripeConnectStatus: "pending",
    },
  });

  return account.id;
}

/**
 * Generate an Account Link URL for onboarding/re-onboarding.
 */
export async function createAccountLink(
  accountId: string,
  origin: string
): Promise<string> {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/settings?connect=refresh`,
    return_url: `${origin}/settings?connect=complete`,
    type: "account_onboarding",
  });
  return accountLink.url;
}

/**
 * Fetch Connect account status from Stripe and sync to DB.
 */
export async function syncConnectStatus(userId: string): Promise<{
  status: string;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeConnectAccountId: true },
  });

  if (!user?.stripeConnectAccountId) {
    return { status: "not_connected", payoutsEnabled: false, detailsSubmitted: false };
  }

  const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);

  let status = "pending";
  if (account.charges_enabled && account.payouts_enabled) {
    status = "active";
  } else if (account.requirements?.currently_due?.length) {
    status = "restricted";
  }

  await prisma.user.update({
    where: { id: userId },
    data: { stripeConnectStatus: status },
  });

  return {
    status,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
  };
}

/**
 * Calculate available balance for a campaign owner.
 */
export async function getAvailableBalance(userId: string): Promise<{
  availableCents: number;
  totalEarnedCents: number;
  totalPaidOutCents: number;
  pendingPayoutCents: number;
}> {
  const earnings = await prisma.campaignPayment.aggregate({
    where: {
      campaign: { userId },
      paymentStatus: "paid",
    },
    _sum: { ownerPayoutCents: true },
  });

  const completedPayouts = await prisma.payout.aggregate({
    where: { userId, status: "completed" },
    _sum: { amountCents: true },
  });

  const pendingPayouts = await prisma.payout.aggregate({
    where: { userId, status: "pending" },
    _sum: { amountCents: true },
  });

  const totalEarnedCents = earnings._sum.ownerPayoutCents ?? 0;
  const totalPaidOutCents = completedPayouts._sum.amountCents ?? 0;
  const pendingPayoutCents = pendingPayouts._sum.amountCents ?? 0;
  const availableCents = totalEarnedCents - totalPaidOutCents - pendingPayoutCents;

  return {
    availableCents: Math.max(0, availableCents),
    totalEarnedCents,
    totalPaidOutCents,
    pendingPayoutCents,
  };
}

/**
 * Calculate fee for a payout based on method.
 */
export function calculatePayoutFee(
  amountCents: number,
  method: "standard" | "instant"
): number {
  if (method === "instant") {
    return Math.ceil(amountCents * INSTANT_PAYOUT_FEE_RATE);
  }
  return 0;
}

/**
 * Execute a payout: create Transfer to connected account.
 * For instant: also trigger instant payout from the connected account.
 */
export async function executePayout(params: {
  userId: string;
  amountCents: number;
  method: "standard" | "instant";
}): Promise<{ payoutId: string; stripeTransferId: string }> {
  const { userId, amountCents, method } = params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeConnectAccountId: true, stripeConnectStatus: true },
  });

  if (!user?.stripeConnectAccountId || user.stripeConnectStatus !== "active") {
    throw new Error("CONNECT_NOT_ACTIVE");
  }

  const feeCents = calculatePayoutFee(amountCents, method);
  const netAmountCents = amountCents - feeCents;

  const payout = await prisma.payout.create({
    data: {
      userId,
      amountCents,
      feeCents,
      netAmountCents,
      method,
      status: "pending",
    },
  });

  try {
    const transfer = await stripe.transfers.create({
      amount: netAmountCents,
      currency: "usd",
      destination: user.stripeConnectAccountId,
      metadata: {
        payoutId: payout.id,
        userId,
        method,
      },
    });

    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        stripeTransferId: transfer.id,
        ...(method === "standard"
          ? { status: "completed", completedAt: new Date() }
          : {}),
      },
    });

    // For instant: trigger instant payout from connected account
    if (method === "instant") {
      try {
        const instantPayout = await stripe.payouts.create(
          { amount: netAmountCents, currency: "usd", method: "instant" },
          { stripeAccount: user.stripeConnectAccountId }
        );

        await prisma.payout.update({
          where: { id: payout.id },
          data: {
            stripePayoutId: instantPayout.id,
            status: "completed",
            completedAt: new Date(),
          },
        });
      } catch (instantErr) {
        // Instant failed but transfer succeeded — funds still arrive on standard schedule
        console.error("Instant payout failed, falling back to standard:", instantErr);
        await prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: "completed",
            completedAt: new Date(),
            failedReason: "instant_failed_fallback_standard",
          },
        });
      }
    }

    return { payoutId: payout.id, stripeTransferId: transfer.id };
  } catch (err) {
    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: "failed",
        failedReason: err instanceof Error ? err.message : "transfer_failed",
      },
    });
    throw err;
  }
}
