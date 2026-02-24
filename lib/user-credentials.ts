import { prisma } from "./db";
import { decrypt } from "./encryption";
import { XCredentials } from "./x-client";

export interface UserXAccountSummary {
  id: string;
  label: string | null;
  username: string | null;
  isDefault: boolean;
  createdAt: Date;
  followersCount: number | null;
  followingCount: number | null;
  lastSyncedAt: Date | null;
}

export interface ResolvedXCredentials {
  accountId: string | null;
  credentials: XCredentials;
}

export async function listUserXAccounts(
  userId: string
): Promise<UserXAccountSummary[]> {
  const accounts = await prisma.xAccount.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      label: true,
      username: true,
      isDefault: true,
      createdAt: true,
      followersCount: true,
      followingCount: true,
      lastSyncedAt: true,
    },
  });

  return accounts;
}

export async function getUserXCredentials(
  userId: string,
  preferredAccountId?: string | null
): Promise<ResolvedXCredentials | null> {
  let account = null;

  if (preferredAccountId) {
    account = await prisma.xAccount.findFirst({
      where: { id: preferredAccountId, userId },
      select: {
        id: true,
        xApiKey: true,
        xApiSecret: true,
        xAccessToken: true,
        xAccessTokenSecret: true,
      },
    });
  } else {
    account = await prisma.xAccount.findFirst({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        xApiKey: true,
        xApiSecret: true,
        xAccessToken: true,
        xAccessTokenSecret: true,
      },
    });
  }

  if (account) {
    return {
      accountId: account.id,
      credentials: {
        apiKey: account.xApiKey ? decrypt(account.xApiKey) : undefined,
        apiSecret: account.xApiSecret ? decrypt(account.xApiSecret) : undefined,
        accessToken: decrypt(account.xAccessToken),
        accessTokenSecret: decrypt(account.xAccessTokenSecret),
      },
    };
  }

  if (preferredAccountId) {
    return null;
  }

  // Backward compatibility for pre-multi-account users.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      xApiKey: true,
      xApiSecret: true,
      xAccessToken: true,
      xAccessTokenSecret: true,
    },
  });

  if (
    !user?.xApiKey ||
    !user?.xApiSecret ||
    !user?.xAccessToken ||
    !user?.xAccessTokenSecret
  ) {
    return null;
  }

  return {
    accountId: null,
    credentials: {
      apiKey: user.xApiKey ? decrypt(user.xApiKey) : undefined,
      apiSecret: user.xApiSecret ? decrypt(user.xApiSecret) : undefined,
      accessToken: decrypt(user.xAccessToken!),
      accessTokenSecret: decrypt(user.xAccessTokenSecret!),
    },
  };
}
