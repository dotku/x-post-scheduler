import { prisma } from "./db";
import { decrypt } from "./encryption";
import { XCredentials } from "./x-client";

export interface UserXAccountSummary {
  id: string;
  label: string | null;
  username: string | null;
  isDefault: boolean;
  createdAt: Date;
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
        apiKey: decrypt(account.xApiKey),
        apiSecret: decrypt(account.xApiSecret),
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
      apiKey: decrypt(user.xApiKey),
      apiSecret: decrypt(user.xApiSecret),
      accessToken: decrypt(user.xAccessToken),
      accessTokenSecret: decrypt(user.xAccessTokenSecret),
    },
  };
}
