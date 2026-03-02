import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { isTierAtLeast } from "@/lib/subscription";
import { hasCredits, deductCredits } from "@/lib/credits";
import { trackTokenUsage } from "@/lib/usage-tracking";
import { getUserXCredentials } from "@/lib/user-credentials";
import { searchRecentTweets, analyzeSentiment } from "@/lib/sentiment-monitor";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }
  const { id } = await params;

  // 1. Tier gate
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { subscriptionTier: true, subscriptionStatus: true },
  });
  if (
    !isTierAtLeast(dbUser?.subscriptionTier, "silver") ||
    dbUser?.subscriptionStatus !== "active"
  ) {
    return NextResponse.json(
      { error: "TIER_REQUIRED", minTier: "silver" },
      { status: 403 },
    );
  }

  // 2. Credit check
  if (!(await hasCredits(user.id))) {
    return NextResponse.json(
      { error: "INSUFFICIENT_CREDITS" },
      { status: 402 },
    );
  }

  // 3. Load topic
  const topic = await prisma.monitorTopic.findFirst({
    where: { id, userId: user.id },
  });
  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  // 4. Parse request body
  const body = await request.json().catch(() => ({}));
  const xAccountId = body.xAccountId as string | undefined;
  const modelId = body.modelId as string | undefined;
  const locale = body.locale as string | undefined;

  // 5. Get X credentials
  const xCreds = await getUserXCredentials(user.id, xAccountId);
  if (!xCreds) {
    return NextResponse.json(
      { error: "No X account connected. Please connect an X account in Settings." },
      { status: 400 },
    );
  }

  // 6. Search X API
  const keywords: string[] = JSON.parse(topic.keywords);
  let tweets;
  let query: string;
  try {
    const searchResult = await searchRecentTweets(keywords, xCreds.credentials);
    tweets = searchResult.tweets;
    query = searchResult.query;
  } catch (err) {
    console.error("[monitoring] X API search error:", err);
    const msg = err instanceof Error ? err.message : "Search failed";
    if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
      return NextResponse.json(
        { error: "X API rate limit reached. Please try again later." },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (tweets.length === 0) {
    return NextResponse.json(
      { error: "No tweets found for these keywords. Try adjusting your keywords." },
      { status: 404 },
    );
  }

  // 7. AI analysis
  const result = await analyzeSentiment(
    tweets,
    topic.name,
    keywords,
    modelId,
    locale,
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Analysis failed" },
      { status: 500 },
    );
  }

  // 8. Deduct credits & track usage
  let costCents: number | null = null;
  if (result.usage && result.modelId) {
    try {
      const creditResult = await deductCredits({
        userId: user.id,
        usage: result.usage,
        model: result.modelId,
        source: "sentiment_monitoring",
      });
      costCents = creditResult.costCents;
    } catch (e) {
      console.error("[monitoring] Failed to deduct credits:", e);
    }
    try {
      await trackTokenUsage({
        userId: user.id,
        source: "sentiment_monitoring",
        model: result.modelId,
        usage: result.usage,
      });
    } catch (e) {
      console.error("[monitoring] Failed to track usage:", e);
    }
  }

  // 9. Save snapshot
  const snapshot = await prisma.topicSnapshot.create({
    data: {
      topicId: id,
      tweetCount: result.tweetCount ?? tweets.length,
      positiveCount: result.sentimentData?.positive ?? 0,
      negativeCount: result.sentimentData?.negative ?? 0,
      neutralCount: result.sentimentData?.neutral ?? 0,
      avgScore:
        result.sentimentData
          ? (result.sentimentData.positive - result.sentimentData.negative) / 100
          : 0,
      themes: result.themes ? JSON.stringify(result.themes) : null,
      topTweets: result.topTweets ? JSON.stringify(result.topTweets) : null,
      aiSummary: result.aiSummary ?? null,
      rawQuery: query,
      modelId: result.modelId,
      costCents,
    },
  });

  return NextResponse.json({
    success: true,
    snapshot,
    sentimentData: result.sentimentData,
    themes: result.themes,
    topTweets: result.topTweets,
    aiSummary: result.aiSummary,
    tweetCount: result.tweetCount,
    costCents,
    usage: result.usage,
  });
}
