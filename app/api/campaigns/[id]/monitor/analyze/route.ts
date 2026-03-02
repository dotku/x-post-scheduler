import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { hasCredits, deductCredits } from "@/lib/credits";
import { trackTokenUsage } from "@/lib/usage-tracking";
import {
  analyzeSentimentBatch,
  analyzeByKeywordRules,
  updateSentimentSnapshot,
} from "@/lib/sentiment-analysis";

export const maxDuration = 60;

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
      select: { id: true, name: true, description: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { tweetIds, forceReanalyze = false } = body;

    // Build query for tweets to analyze
    const where: {
      campaignId: string;
      id?: { in: string[] };
      analyzedAt?: null;
    } = { campaignId: id };

    if (Array.isArray(tweetIds) && tweetIds.length > 0) {
      where.id = { in: tweetIds };
    }

    if (!forceReanalyze) {
      where.analyzedAt = null;
    }

    const tweetsToAnalyze = await prisma.monitorTweet.findMany({
      where,
      select: { id: true, text: true, authorUsername: true },
    });

    if (tweetsToAnalyze.length === 0) {
      return NextResponse.json({
        analyzed: 0,
        method: "none",
        message: "No tweets to analyze",
      });
    }

    // Get campaign keywords for context
    const keywords = await prisma.monitorKeyword.findMany({
      where: { campaignId: id },
      select: { keyword: true, type: true },
    });

    // Determine analysis method: AI or keyword fallback
    const canUseAi = await hasCredits(user.id);
    let output;

    if (canUseAi) {
      // Process in batches of 20 for AI
      const allResults = [];
      let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      let modelId: string | undefined;

      for (let i = 0; i < tweetsToAnalyze.length; i += 20) {
        const batch = tweetsToAnalyze.slice(i, i + 20);
        const batchOutput = await analyzeSentimentBatch({
          tweets: batch.map((t) => ({
            id: t.id,
            text: t.text,
            authorUsername: t.authorUsername || undefined,
          })),
          keywords,
          campaignContext: `Campaign: ${campaign.name}. ${campaign.description || ""}`,
        });

        allResults.push(...batchOutput.results);
        if (batchOutput.usage) {
          totalUsage.promptTokens += batchOutput.usage.promptTokens;
          totalUsage.completionTokens += batchOutput.usage.completionTokens;
          totalUsage.totalTokens += batchOutput.usage.totalTokens;
        }
        if (batchOutput.modelId) modelId = batchOutput.modelId;
      }

      output = {
        results: allResults,
        usage: totalUsage,
        modelId,
        method: "ai" as const,
      };
    } else {
      // Keyword fallback
      output = analyzeByKeywordRules({
        tweets: tweetsToAnalyze.map((t) => ({
          id: t.id,
          text: t.text,
          authorUsername: t.authorUsername || undefined,
        })),
        keywords,
      });
    }

    // Update tweets with sentiment results
    for (const result of output.results) {
      await prisma.monitorTweet.update({
        where: { id: result.tweetId },
        data: {
          sentiment: result.sentiment,
          sentimentScore: result.score,
          keyTopics: JSON.stringify(result.keyTopics),
          analyzedAt: new Date(),
          analysisMethod: output.method,
        },
      });
    }

    // Deduct credits if AI was used
    if (output.method === "ai" && output.usage && output.usage.totalTokens > 0) {
      await deductCredits({
        userId: user.id,
        usage: output.usage,
        model: output.modelId,
        source: "sentiment-analysis",
      });

      await trackTokenUsage({
        userId: user.id,
        source: "sentiment-analysis",
        model: output.modelId,
        usage: output.usage,
      });
    }

    // Update sentiment snapshot
    await updateSentimentSnapshot(id);

    // Count results by sentiment
    const summary = {
      positive: output.results.filter((r) => r.sentiment === "positive").length,
      negative: output.results.filter((r) => r.sentiment === "negative").length,
      neutral: output.results.filter((r) => r.sentiment === "neutral").length,
    };

    return NextResponse.json({
      analyzed: output.results.length,
      method: output.method,
      usedCredits: output.method === "ai",
      summary,
    });
  } catch (error) {
    console.error("[monitor/analyze] POST error:", error);
    return NextResponse.json(
      { error: "Failed to analyze tweets" },
      { status: 500 }
    );
  }
}
