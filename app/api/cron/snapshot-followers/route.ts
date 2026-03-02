import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { getUserProfile } from "@/lib/x-client";

// POST: Record daily follower snapshots for all active users with X accounts
// Called by Cloudflare cron daily
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all X accounts
  const accounts = await prisma.xAccount.findMany({
    select: {
      id: true,
      userId: true,
      xApiKey: true,
      xApiSecret: true,
      xAccessToken: true,
      xAccessTokenSecret: true,
    },
  });

  let snapshotted = 0;
  let errors = 0;

  for (const account of accounts) {
    try {
      const credentials = {
        apiKey: account.xApiKey ? decrypt(account.xApiKey) : undefined,
        apiSecret: account.xApiSecret ? decrypt(account.xApiSecret) : undefined,
        accessToken: decrypt(account.xAccessToken),
        accessTokenSecret: decrypt(account.xAccessTokenSecret),
      };

      const profile = await getUserProfile(credentials);
      if (!profile) continue;

      await prisma.followerSnapshot.create({
        data: {
          userId: account.userId,
          xAccountId: account.id,
          followersCount: profile.followersCount,
          followingCount: profile.followingCount,
          tweetCount: profile.tweetCount,
        },
      });

      // Also update the XAccount record
      await prisma.xAccount.update({
        where: { id: account.id },
        data: {
          followersCount: profile.followersCount,
          followingCount: profile.followingCount,
          username: profile.username,
          lastSyncedAt: new Date(),
        },
      });

      snapshotted++;
    } catch (error) {
      console.error(`Failed to snapshot account ${account.id}:`, error);
      errors++;
    }
  }

  return NextResponse.json({ snapshotted, errors, total: accounts.length });
}
