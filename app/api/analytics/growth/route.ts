import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

// GET: Return follower growth snapshots + post performance over time
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period") ?? "30";
  const period = [7, 30, 90].includes(Number(periodParam))
    ? Number(periodParam)
    : 30;

  const since = new Date();
  since.setDate(since.getDate() - period);

  const [snapshots, posts, accounts] = await Promise.all([
    // Follower snapshots over time
    prisma.followerSnapshot.findMany({
      where: { userId: user.id, recordedAt: { gte: since } },
      orderBy: { recordedAt: "asc" },
      select: {
        followersCount: true,
        followingCount: true,
        tweetCount: true,
        recordedAt: true,
        xAccountId: true,
      },
    }),
    // Posts with engagement metrics in period
    prisma.post.findMany({
      where: {
        userId: user.id,
        status: "posted",
        postedAt: { gte: since },
      },
      orderBy: { postedAt: "desc" },
      select: {
        id: true,
        content: true,
        impressions: true,
        likes: true,
        retweets: true,
        replies: true,
        postedAt: true,
      },
    }),
    // Current account stats
    prisma.xAccount.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        label: true,
        username: true,
        followersCount: true,
        followingCount: true,
      },
    }),
  ]);

  // Calculate engagement rates and find top posts
  const postsWithEngagement = posts.map((p) => {
    const impressions = p.impressions ?? 0;
    const likes = p.likes ?? 0;
    const retweets = p.retweets ?? 0;
    const replies = p.replies ?? 0;
    const engagements = likes + retweets + replies;
    const engagementRate =
      impressions > 0 ? (engagements / impressions) * 100 : 0;
    return { ...p, engagements, engagementRate: Number(engagementRate.toFixed(2)) };
  });

  // Aggregate daily impressions
  const dailyImpressions: Record<string, number> = {};
  const dailyPostCount: Record<string, number> = {};
  for (const post of posts) {
    if (post.postedAt) {
      const date = post.postedAt.toISOString().split("T")[0];
      dailyImpressions[date] = (dailyImpressions[date] ?? 0) + (post.impressions ?? 0);
      dailyPostCount[date] = (dailyPostCount[date] ?? 0) + 1;
    }
  }

  // Fill in zero days
  const dailyData: Array<{ date: string; impressions: number; posts: number }> = [];
  const cursor = new Date(since);
  const today = new Date();
  while (cursor <= today) {
    const dateStr = cursor.toISOString().split("T")[0];
    dailyData.push({
      date: dateStr,
      impressions: dailyImpressions[dateStr] ?? 0,
      posts: dailyPostCount[dateStr] ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Top 5 posts by engagement rate
  const topPosts = [...postsWithEngagement]
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 5);

  // Summary stats
  const totalImpressions = posts.reduce((s, p) => s + (p.impressions ?? 0), 0);
  const totalEngagements = postsWithEngagement.reduce((s, p) => s + p.engagements, 0);
  const avgEngagementRate =
    totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0;

  return NextResponse.json({
    period,
    followerSnapshots: snapshots,
    dailyData,
    topPosts,
    accounts,
    summary: {
      totalPosts: posts.length,
      totalImpressions,
      totalEngagements,
      avgEngagementRate: Number(avgEngagementRate.toFixed(2)),
    },
  });
}
