import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;
  const days = parseInt(request.nextUrl.searchParams.get("days") || "30", 10);

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Overview: aggregate counts
    const allTweets = await prisma.monitorTweet.count({
      where: { campaignId: id },
    });

    const analyzed = await prisma.monitorTweet.count({
      where: { campaignId: id, analyzedAt: { not: null } },
    });

    const sentimentCounts = await prisma.monitorTweet.groupBy({
      by: ["sentiment"],
      where: { campaignId: id, sentiment: { not: null } },
      _count: true,
    });

    const avgResult = await prisma.monitorTweet.aggregate({
      where: { campaignId: id, sentimentScore: { not: null } },
      _avg: { sentimentScore: true },
    });

    const positive =
      sentimentCounts.find((c) => c.sentiment === "positive")?._count ?? 0;
    const negative =
      sentimentCounts.find((c) => c.sentiment === "negative")?._count ?? 0;
    const neutral =
      sentimentCounts.find((c) => c.sentiment === "neutral")?._count ?? 0;

    // Trend: daily snapshots
    const since = new Date();
    since.setDate(since.getDate() - days);

    const snapshots = await prisma.sentimentSnapshot.findMany({
      where: { campaignId: id, date: { gte: since } },
      orderBy: { date: "asc" },
    });

    const trend = snapshots.map((s) => ({
      date: s.date.toISOString().split("T")[0],
      positive: s.positiveCount,
      negative: s.negativeCount,
      neutral: s.neutralCount,
      avgScore: s.avgScore,
      tweetCount: s.tweetCount,
    }));

    // Alerts: detect negative spikes
    const alerts: Array<{
      date: string;
      type: string;
      count: number;
      threshold: number;
    }> = [];

    if (trend.length >= 3) {
      // Calculate rolling 7-day average of negative counts
      for (let i = 0; i < trend.length; i++) {
        const windowStart = Math.max(0, i - 6);
        const window = trend.slice(windowStart, i + 1);
        const avgNeg =
          window.reduce((sum, d) => sum + d.negative, 0) / window.length;
        const threshold = Math.max(3, avgNeg * 2);

        if (trend[i].negative >= threshold && trend[i].negative >= 3) {
          alerts.push({
            date: trend[i].date,
            type: "negative_spike",
            count: trend[i].negative,
            threshold: Math.round(threshold),
          });
        }
      }
    }

    return NextResponse.json({
      overview: {
        totalTweets: allTweets,
        analyzed,
        positive,
        negative,
        neutral,
        avgScore: avgResult._avg.sentimentScore ?? 0,
      },
      trend,
      alerts,
    });
  } catch (error) {
    console.error("[monitor/summary] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch summary" },
      { status: 500 }
    );
  }
}
