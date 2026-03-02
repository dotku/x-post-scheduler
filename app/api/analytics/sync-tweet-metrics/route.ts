import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { decrypt } from "@/lib/encryption";
import { batchTweetMetrics, XCredentials } from "@/lib/x-client";
import { isProfileStale, generateContentProfile } from "@/lib/content-profile";
import { trackTokenUsage } from "@/lib/usage-tracking";
import { hasCredits, deductCredits } from "@/lib/credits";

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period") ?? "30";
  const period = [7, 30, 90].includes(Number(periodParam)) ? Number(periodParam) : 30;

  const since = new Date();
  since.setDate(since.getDate() - period);

  // Get all posted tweets for this user in the period that have a tweetId
  const posts = await prisma.post.findMany({
    where: {
      userId: user.id,
      status: "posted",
      tweetId: { not: null },
      postedAt: { gte: since },
    },
    select: { id: true, tweetId: true, xAccountId: true },
  });

  if (posts.length === 0) {
    return NextResponse.json({ synced: 0, totalImpressions: 0 });
  }

  // Group posts by xAccountId (null → use default account)
  const groupedByAccount = new Map<string | null, typeof posts>();
  for (const post of posts) {
    const key = post.xAccountId ?? null;
    if (!groupedByAccount.has(key)) groupedByAccount.set(key, []);
    groupedByAccount.get(key)!.push(post);
  }

  // Load credentials for each unique xAccountId
  const accountCredentials = new Map<string | null, XCredentials | null>();
  const xAccountIds = [...groupedByAccount.keys()].filter((k): k is string => k !== null);

  if (xAccountIds.length > 0) {
    const accounts = await prisma.xAccount.findMany({
      where: { id: { in: xAccountIds }, userId: user.id },
      select: {
        id: true,
        xApiKey: true,
        xApiSecret: true,
        xAccessToken: true,
        xAccessTokenSecret: true,
      },
    });
    for (const acc of accounts) {
      accountCredentials.set(acc.id, {
        apiKey: acc.xApiKey ? decrypt(acc.xApiKey) : undefined,
        apiSecret: acc.xApiSecret ? decrypt(acc.xApiSecret) : undefined,
        accessToken: decrypt(acc.xAccessToken),
        accessTokenSecret: decrypt(acc.xAccessTokenSecret),
      });
    }
  }

  // Fallback to legacy per-user credentials if no xAccountId
  if (groupedByAccount.has(null)) {
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        xApiKey: true,
        xApiSecret: true,
        xAccessToken: true,
        xAccessTokenSecret: true,
      },
    });
    if (u?.xApiKey && u.xApiSecret && u.xAccessToken && u.xAccessTokenSecret) {
      accountCredentials.set(null, {
        apiKey: decrypt(u.xApiKey),
        apiSecret: decrypt(u.xApiSecret),
        accessToken: decrypt(u.xAccessToken),
        accessTokenSecret: decrypt(u.xAccessTokenSecret),
      });
    } else {
      accountCredentials.set(null, null);
    }
  }

  // Fetch metrics from X API and update DB
  let synced = 0;
  let totalImpressions = 0;
  const updates: { id: string; impressions: number; likes: number; retweets: number; replies: number }[] = [];

  for (const [accountId, accountPosts] of groupedByAccount) {
    const creds = accountCredentials.get(accountId);
    if (!creds) continue;

    const tweetIds = accountPosts.map((p) => p.tweetId!);
    const metricsMap = await batchTweetMetrics(tweetIds, creds);

    for (const post of accountPosts) {
      const metrics = metricsMap.get(post.tweetId!);
      if (metrics) {
        updates.push({
          id: post.id,
          impressions: metrics.impressions,
          likes: metrics.likes,
          retweets: metrics.retweets,
          replies: metrics.replies,
        });
        totalImpressions += metrics.impressions;
        synced++;
      }
    }
  }

  // Batch update all metrics in DB
  if (updates.length > 0) {
    await Promise.all(
      updates.map((u) =>
        prisma.post.update({
          where: { id: u.id },
          data: {
            impressions: u.impressions,
            likes: u.likes,
            retweets: u.retweets,
            replies: u.replies,
          },
        })
      )
    );
  }

  // Auto-refresh content profile if stale (>7 days)
  let profileRefreshed = false;
  if (synced > 0) {
    try {
      const stale = await isProfileStale(user.id);
      if (stale && (await hasCredits(user.id))) {
        const profileResult = await generateContentProfile(user.id);
        if (profileResult.success && profileResult.usage) {
          await trackTokenUsage({
            userId: user.id,
            source: "content_profile_auto_refresh",
            usage: profileResult.usage,
            model: profileResult.model,
          });
          await deductCredits({
            userId: user.id,
            usage: profileResult.usage,
            model: profileResult.model,
            source: "content_profile_auto_refresh",
          });
          profileRefreshed = true;
        }
      }
    } catch (error) {
      console.error("Failed to auto-refresh content profile:", error);
    }
  }

  return NextResponse.json({ synced, totalImpressions, profileRefreshed });
}
