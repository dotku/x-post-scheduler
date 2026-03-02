import { stripe } from "./stripe";
import { prisma } from "./db";

interface AchBankDetails {
  accountHolderName: string;
  routingNumber: string;
  accountNumber: string;
  accountType: "checking" | "savings";
}

/**
 * Create a Stripe Custom Connect account with an attached bank account,
 * or update the bank account if the user already has an ACH Custom account.
 */
export async function setupAchAccount(
  userId: string,
  bankDetails: AchBankDetails,
  userIp: string,
  email?: string | null,
): Promise<{ accountId: string; bankLast4: string; bankName: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { achConnectAccountId: true, email: true },
  });

  if (user?.achConnectAccountId) {
    // Already exists — replace the external bank account
    const existingAccounts = await stripe.accounts.listExternalAccounts(
      user.achConnectAccountId,
      { object: "bank_account" },
    );
    for (const ea of existingAccounts.data) {
      await stripe.accounts.deleteExternalAccount(
        user.achConnectAccountId,
        ea.id,
      );
    }

    const bankAccount = (await stripe.accounts.createExternalAccount(
      user.achConnectAccountId,
      {
        external_account: {
          object: "bank_account",
          country: "US",
          currency: "usd",
          account_holder_name: bankDetails.accountHolderName,
          routing_number: bankDetails.routingNumber,
          account_number: bankDetails.accountNumber,
          account_holder_type: "individual",
        } as unknown as string,
      },
    )) as unknown as { last4: string; bank_name: string };

    await prisma.user.update({
      where: { id: userId },
      data: {
        achBankLast4: bankAccount.last4,
        achBankName: bankAccount.bank_name ?? "Bank",
      },
    });

    return {
      accountId: user.achConnectAccountId,
      bankLast4: bankAccount.last4,
      bankName: bankAccount.bank_name ?? "Bank",
    };
  }

  // Create a new Custom Connect account
  const account = await stripe.accounts.create({
    type: "custom",
    country: "US",
    email: email ?? user?.email ?? undefined,
    capabilities: {
      transfers: { requested: true },
    },
    business_type: "individual",
    tos_acceptance: {
      date: Math.floor(Date.now() / 1000),
      ip: userIp,
    },
    external_account: {
      object: "bank_account",
      country: "US",
      currency: "usd",
      account_holder_name: bankDetails.accountHolderName,
      routing_number: bankDetails.routingNumber,
      account_number: bankDetails.accountNumber,
      account_holder_type: "individual",
    } as unknown as string,
    metadata: { userId, type: "ach_direct" },
  });

  // Extract bank info from the created external account
  const bankData = account.external_accounts?.data?.[0] as unknown as
    | { last4: string; bank_name: string }
    | undefined;

  const bankLast4 = bankData?.last4 ?? bankDetails.accountNumber.slice(-4);
  const bankName = bankData?.bank_name ?? "Bank";

  // Determine initial status
  let status = "pending";
  if (account.charges_enabled && account.payouts_enabled) {
    status = "active";
  } else if (account.requirements?.currently_due?.length) {
    status = "restricted";
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      achConnectAccountId: account.id,
      achConnectStatus: status,
      achBankLast4: bankLast4,
      achBankName: bankName,
    },
  });

  return { accountId: account.id, bankLast4, bankName };
}

/**
 * Fetch ACH Custom Connect account status from Stripe and sync to DB.
 */
export async function getAchStatus(userId: string): Promise<{
  status: string;
  payoutsEnabled: boolean;
  bankLast4: string | null;
  bankName: string | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      achConnectAccountId: true,
      achBankLast4: true,
      achBankName: true,
    },
  });

  if (!user?.achConnectAccountId) {
    return {
      status: "not_connected",
      payoutsEnabled: false,
      bankLast4: null,
      bankName: null,
    };
  }

  const account = await stripe.accounts.retrieve(user.achConnectAccountId);

  let status = "pending";
  if (account.charges_enabled && account.payouts_enabled) {
    status = "active";
  } else if (account.requirements?.currently_due?.length) {
    status = "restricted";
  }

  await prisma.user.update({
    where: { id: userId },
    data: { achConnectStatus: status },
  });

  return {
    status,
    payoutsEnabled: account.payouts_enabled ?? false,
    bankLast4: user.achBankLast4,
    bankName: user.achBankName,
  };
}

/**
 * Remove the ACH Custom Connect account setup.
 */
export async function removeAchAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { achConnectAccountId: true },
  });

  if (user?.achConnectAccountId) {
    try {
      await stripe.accounts.del(user.achConnectAccountId);
    } catch (err) {
      console.error("Failed to delete Stripe Custom account:", err);
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      achConnectAccountId: null,
      achConnectStatus: null,
      achBankLast4: null,
      achBankName: null,
    },
  });
}
