import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getUserProfile } from "@/lib/x-client";
import { decrypt } from "@/lib/encryption";

export async function POST() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const accounts = await prisma.xAccount.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      label: true,
      username: true,
      xApiKey: true,
      xApiSecret: true,
      xAccessToken: true,
      xAccessTokenSecret: true,
    },
  });

  let synced = 0;
  let totalFollowers = 0;

  for (const account of accounts) {
    try {
      const credentials = {
        apiKey: decrypt(account.xApiKey),
        apiSecret: decrypt(account.xApiSecret),
        accessToken: decrypt(account.xAccessToken),
        accessTokenSecret: decrypt(account.xAccessTokenSecret),
      };

      const profile = await getUserProfile(credentials);
      if (profile) {
        await prisma.xAccount.update({
          where: { id: account.id },
          data: {
            followersCount: profile.followersCount,
            followingCount: profile.followingCount,
            username: profile.username || account.username,
            lastSyncedAt: new Date(),
          },
        });
        synced++;
        totalFollowers += profile.followersCount;
      }
    } catch (error) {
      console.error(
        `Failed to sync followers for account ${account.id}:`,
        error,
      );
      // Continue with next account
    }
  }

  return NextResponse.json({
    synced,
    totalFollowers,
    totalAccounts: accounts.length,
  });
}
