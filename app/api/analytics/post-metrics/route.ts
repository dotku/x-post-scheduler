import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getUserXCredentials } from "@/lib/user-credentials";
import { getRecentTweetsWithMetrics, getUserInfo } from "@/lib/x-client";

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period") ?? "30";
  const accountId = searchParams.get("accountId");
  const period = [7, 30, 90].includes(Number(periodParam)) ? Number(periodParam) : 30;

  const since = new Date();
  since.setDate(since.getDate() - period);

  // Determine which account(s) to fetch from
  let accountsToFetch: Array<{ id: string; label: string | null; username: string | null }> = [];

  if (accountId && accountId !== "all") {
    const account = await prisma.xAccount.findFirst({
      where: { id: accountId, userId: user.id },
      select: { id: true, label: true, username: true },
    });
    if (account) {
      accountsToFetch = [account];
    }
  } else {
    accountsToFetch = await prisma.xAccount.findMany({
      where: { userId: user.id },
      select: { id: true, label: true, username: true },
    });
  }

  // Fetch tweets from X API for each account
  const allPostMetrics: Array<{
    id: string;
    content: string;
    tweetId: string;
    postedAt: Date | null;
    impressions: number;
    likes: number;
    replies: number;
    engagements: number;
    engagementRate: number;
    account: { label: string | null; username: string | null } | null;
  }> = [];

  let totalFollowers = 0;
  let accountCount = 0;

  for (const account of accountsToFetch) {
    try {
      const credentials = await getUserXCredentials(user.id, account.id);
      if (!credentials) continue;

      // Fetch user info for follower count
      const userInfo = await getUserInfo(credentials.credentials);
      totalFollowers += userInfo.followersCount;
      accountCount++;

      // Fetch recent tweets with metrics
      const tweets = await getRecentTweetsWithMetrics(100, credentials.credentials);

      // Filter by time period and calculate metrics
      for (const tweet of tweets) {
        if (tweet.createdAt && tweet.createdAt >= since) {
          const engagements = tweet.likes + tweet.replies + tweet.retweets + tweet.quotes;
          const engagementRate = tweet.impressions > 0 ? (engagements / tweet.impressions) * 100 : 0;

          allPostMetrics.push({
            id: tweet.id,
            content: tweet.text,
            tweetId: tweet.id,
            postedAt: tweet.createdAt,
            impressions: tweet.impressions,
            likes: tweet.likes,
            replies: tweet.replies,
            engagements,
            engagementRate: Number(engagementRate.toFixed(2)),
            account: {
              label: account.label,
              username: account.username,
            },
          });
        }
      }
    } catch (error) {
      console.error(`Failed to fetch tweets for account ${account.id}:`, error);
      // Continue with other accounts
    }
  }

  // Sort by posted date descending
  allPostMetrics.sort((a, b) => {
    if (!a.postedAt) return 1;
    if (!b.postedAt) return -1;
    return b.postedAt.getTime() - a.postedAt.getTime();
  });

  return NextResponse.json({
    period,
    posts: allPostMetrics,
    totalFollowers: accountCount > 0 ? Math.round(totalFollowers / accountCount) : 0,
  });
}
