import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getUserXCredentials } from "@/lib/user-credentials";
import { lookupTweetsByIds, getRecentTweetsWithMetrics } from "@/lib/x-client";

/** Extract tweet ID from an x.com or twitter.com URL */
function parseTweetId(url: string): string | null {
  const match = url.match(/(?:x\.com|twitter\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

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
  const sentiment = request.nextUrl.searchParams.get("sentiment");
  const page = parseInt(request.nextUrl.searchParams.get("page") || "1", 10);
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const where: { campaignId: string; sentiment?: string } = { campaignId: id };
    if (sentiment && ["positive", "negative", "neutral"].includes(sentiment)) {
      where.sentiment = sentiment;
    }

    const [tweets, total] = await Promise.all([
      prisma.monitorTweet.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.monitorTweet.count({ where }),
    ]);

    return NextResponse.json({ tweets, total });
  } catch (error) {
    console.error("[monitor/tweets] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch tweets" }, { status: 500 });
  }
}

export async function POST(
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

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await request.json();
    const { urls, source } = body;

    // Timeline scan mode
    if (source === "timeline_scan") {
      return await handleTimelineScan(user.id, id, body.limit || 20);
    }

    // Manual URL mode
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "urls array is required" }, { status: 400 });
    }

    // Parse tweet IDs from URLs
    const tweetIdMap = new Map<string, string>(); // tweetId → url
    for (const url of urls) {
      const tweetId = parseTweetId(url);
      if (tweetId) {
        tweetIdMap.set(tweetId, url);
      }
    }

    if (tweetIdMap.size === 0) {
      return NextResponse.json(
        { error: "No valid tweet URLs found" },
        { status: 400 }
      );
    }

    // Check which tweets already exist
    const existing = await prisma.monitorTweet.findMany({
      where: { campaignId: id, tweetId: { in: Array.from(tweetIdMap.keys()) } },
      select: { tweetId: true },
    });
    const existingIds = new Set(existing.map((e) => e.tweetId));
    const newTweetIds = Array.from(tweetIdMap.keys()).filter(
      (tid) => !existingIds.has(tid)
    );

    if (newTweetIds.length === 0) {
      return NextResponse.json({
        added: 0,
        skipped: tweetIdMap.size,
        tweets: [],
      });
    }

    // Fetch tweet data from X API
    const resolved = await getUserXCredentials(user.id);
    if (!resolved) {
      return NextResponse.json(
        { error: "No X account connected" },
        { status: 400 }
      );
    }

    const tweetData = await lookupTweetsByIds(newTweetIds, resolved.credentials);
    const created = [];

    for (const tweet of tweetData) {
      try {
        const record = await prisma.monitorTweet.create({
          data: {
            tweetId: tweet.id,
            tweetUrl:
              tweetIdMap.get(tweet.id) ||
              `https://x.com/${tweet.authorUsername}/status/${tweet.id}`,
            authorUsername: tweet.authorUsername || null,
            authorName: tweet.authorName || null,
            text: tweet.text,
            tweetCreatedAt: tweet.createdAt,
            impressions: tweet.impressions,
            likes: tweet.likes,
            retweets: tweet.retweets,
            replies: tweet.replies,
            source: "manual",
            campaignId: id,
          },
        });
        created.push(record);
      } catch {
        // Skip duplicates silently
      }
    }

    return NextResponse.json({
      added: created.length,
      skipped: tweetIdMap.size - created.length,
      tweets: created,
    });
  } catch (error) {
    console.error("[monitor/tweets] POST error:", error);
    return NextResponse.json({ error: "Failed to add tweets" }, { status: 500 });
  }
}

async function handleTimelineScan(
  userId: string,
  campaignId: string,
  limit: number
) {
  try {
    const resolved = await getUserXCredentials(userId);
    if (!resolved) {
      return NextResponse.json(
        { error: "No X account connected" },
        { status: 400 }
      );
    }

    // Get campaign keywords for matching
    const keywords = await prisma.monitorKeyword.findMany({
      where: { campaignId },
      select: { keyword: true },
    });

    if (keywords.length === 0) {
      return NextResponse.json(
        { error: "Add keywords first to scan timeline" },
        { status: 400 }
      );
    }

    const keywordList = keywords.map((k) => k.keyword.toLowerCase());

    // Fetch user's recent tweets
    const timeline = await getRecentTweetsWithMetrics(
      Math.min(100, Math.max(5, limit)),
      resolved.credentials
    );

    // Filter tweets that match any keyword
    const matching = timeline.filter((tweet) => {
      const textLower = tweet.text.toLowerCase();
      return keywordList.some((kw) => textLower.includes(kw));
    });

    // Get existing tweet IDs to skip duplicates
    const existingIds = new Set(
      (
        await prisma.monitorTweet.findMany({
          where: {
            campaignId,
            tweetId: { in: matching.map((t) => t.id) },
          },
          select: { tweetId: true },
        })
      ).map((e) => e.tweetId)
    );

    const created = [];
    for (const tweet of matching) {
      if (existingIds.has(tweet.id)) continue;
      try {
        const record = await prisma.monitorTweet.create({
          data: {
            tweetId: tweet.id,
            tweetUrl: `https://x.com/i/status/${tweet.id}`,
            text: tweet.text,
            tweetCreatedAt: tweet.createdAt,
            impressions: tweet.impressions,
            likes: tweet.likes,
            retweets: tweet.retweets,
            replies: tweet.replies,
            source: "timeline_scan",
            campaignId,
          },
        });
        created.push(record);
      } catch {
        // Skip duplicates
      }
    }

    return NextResponse.json({
      added: created.length,
      skipped: matching.length - created.length,
      scanned: timeline.length,
      tweets: created,
    });
  } catch (error) {
    console.error("[monitor/tweets] timeline scan error:", error);
    return NextResponse.json(
      { error: "Failed to scan timeline" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
  const tweetRecordId = request.nextUrl.searchParams.get("tweetId");

  if (!tweetRecordId) {
    return NextResponse.json({ error: "tweetId is required" }, { status: 400 });
  }

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    await prisma.monitorTweet.delete({
      where: { id: tweetRecordId, campaignId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[monitor/tweets] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete tweet" }, { status: 500 });
  }
}
