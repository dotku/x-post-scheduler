import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { resolveTextModel } from "./ai-models";
import { prisma } from "./db";
import type { TokenUsage } from "./usage-tracking";

export interface SentimentResult {
  tweetId: string; // MonitorTweet.id (cuid)
  sentiment: "positive" | "negative" | "neutral";
  score: number; // -1.0 to 1.0
  keyTopics: string[];
}

export interface SentimentAnalysisOutput {
  results: SentimentResult[];
  usage?: TokenUsage;
  modelId?: string;
  method: "ai" | "keyword_rule";
}

interface TweetInput {
  id: string;
  text: string;
  authorUsername?: string;
}

interface KeywordInput {
  keyword: string;
  type: string; // "track" | "negative" | "competitor"
}

/**
 * Batch sentiment analysis using AI (GPT-4o-mini for cost efficiency).
 */
export async function analyzeSentimentBatch(params: {
  tweets: TweetInput[];
  keywords: KeywordInput[];
  campaignContext?: string;
  modelId?: string;
}): Promise<SentimentAnalysisOutput> {
  const { tweets, keywords, campaignContext } = params;
  if (tweets.length === 0) {
    return { results: [], method: "ai" };
  }

  const model = resolveTextModel(params.modelId || "openai/gpt-4o-mini");

  const trackKeywords = keywords
    .filter((k) => k.type === "track")
    .map((k) => k.keyword)
    .join(", ");
  const negativeKeywords = keywords
    .filter((k) => k.type === "negative")
    .map((k) => k.keyword)
    .join(", ");
  const competitorKeywords = keywords
    .filter((k) => k.type === "competitor")
    .map((k) => k.keyword)
    .join(", ");

  const tweetList = tweets
    .map((t, i) => `[${i}] @${t.authorUsername || "unknown"}: ${t.text}`)
    .join("\n");

  const systemPrompt = `You are a social media sentiment analyst specializing in political and brand monitoring.

Analyze each tweet and return a JSON array with:
- tweetIndex: the 0-based index of the tweet
- sentiment: "positive" | "negative" | "neutral"
- score: number from -1.0 (very negative) to 1.0 (very positive)
- keyTopics: array of 1-3 key topics/themes mentioned

${campaignContext ? `Campaign context:\n${campaignContext}\n` : ""}
Keywords being tracked:
${trackKeywords ? `- Track: ${trackKeywords}` : ""}
${negativeKeywords ? `- Negative/Alert: ${negativeKeywords}` : ""}
${competitorKeywords ? `- Competitor: ${competitorKeywords}` : ""}

Guidelines:
- Consider the tweet's tone, language, and implied sentiment
- Tweets matching "negative" keywords that are critical should score lower
- Tweets about competitors should be analyzed for how they compare
- Return ONLY valid JSON array, no markdown fences or extra text`;

  try {
    const result = await generateText({
      model: gateway(model.id),
      system: systemPrompt,
      prompt: `Analyze these tweets:\n\n${tweetList}`,
      maxOutputTokens: Math.max(200, tweets.length * 80),
      temperature: 0.3,
    });

    const text = result.text?.trim();
    if (!text) {
      return { results: [], method: "ai", modelId: model.id };
    }

    // Parse JSON — strip code fences if present
    const jsonStr = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    let parsed: Array<{
      tweetIndex: number;
      sentiment: string;
      score: number;
      keyTopics: string[];
    }>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("[sentiment-analysis] Failed to parse AI response:", text);
      return { results: [], method: "ai", modelId: model.id };
    }

    const results: SentimentResult[] = [];
    for (const item of parsed) {
      if (item.tweetIndex < 0 || item.tweetIndex >= tweets.length) continue;
      const sentiment = validateSentiment(item.sentiment);
      results.push({
        tweetId: tweets[item.tweetIndex].id,
        sentiment,
        score: Math.max(-1, Math.min(1, item.score ?? 0)),
        keyTopics: Array.isArray(item.keyTopics) ? item.keyTopics.slice(0, 3) : [],
      });
    }

    const inputTokens = result.usage.inputTokens ?? 0;
    const outputTokens = result.usage.outputTokens ?? 0;

    return {
      results,
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      modelId: model.id,
      method: "ai",
    };
  } catch (error) {
    console.error("[sentiment-analysis] AI analysis error:", error);
    return { results: [], method: "ai", modelId: model.id };
  }
}

function validateSentiment(s: string): "positive" | "negative" | "neutral" {
  if (s === "positive" || s === "negative" || s === "neutral") return s;
  return "neutral";
}

// Built-in positive/negative word lists for keyword fallback
const POSITIVE_WORDS = [
  "great", "excellent", "love", "support", "win", "best", "amazing", "good",
  "wonderful", "fantastic", "proud", "success", "approve", "agree", "trust",
  "好", "赞", "支持", "优秀", "棒", "厉害", "信任", "认同", "点赞", "加油",
];

const NEGATIVE_WORDS = [
  "bad", "terrible", "hate", "fail", "scandal", "worst", "awful", "corrupt",
  "lie", "cheat", "fraud", "oppose", "reject", "distrust", "disappoint",
  "差", "烂", "反对", "丑闻", "骗", "失败", "腐败", "恶心", "不信任", "失望",
];

/**
 * Keyword-based sentiment analysis (fallback when AI credits insufficient).
 */
export function analyzeByKeywordRules(params: {
  tweets: TweetInput[];
  keywords: KeywordInput[];
}): SentimentAnalysisOutput {
  const { tweets, keywords } = params;
  const negativeKeywords = keywords
    .filter((k) => k.type === "negative")
    .map((k) => k.keyword.toLowerCase());

  const results: SentimentResult[] = tweets.map((tweet) => {
    const textLower = tweet.text.toLowerCase();

    // Count matches
    let positiveMatches = 0;
    let negativeMatches = 0;

    for (const word of POSITIVE_WORDS) {
      if (textLower.includes(word)) positiveMatches++;
    }
    for (const word of NEGATIVE_WORDS) {
      if (textLower.includes(word)) negativeMatches++;
    }

    // Alert keywords count as negative
    for (const kw of negativeKeywords) {
      if (textLower.includes(kw)) negativeMatches += 2;
    }

    const total = positiveMatches + negativeMatches;
    let score = 0;
    let sentiment: "positive" | "negative" | "neutral" = "neutral";

    if (total > 0) {
      score = (positiveMatches - negativeMatches) / total;
      score = Math.max(-1, Math.min(1, score));
      if (score > 0.2) sentiment = "positive";
      else if (score < -0.2) sentiment = "negative";
    }

    // Extract key topics from matched keywords
    const keyTopics: string[] = [];
    for (const kw of keywords) {
      if (textLower.includes(kw.keyword.toLowerCase())) {
        keyTopics.push(kw.keyword);
        if (keyTopics.length >= 3) break;
      }
    }

    return {
      tweetId: tweet.id,
      sentiment,
      score,
      keyTopics,
    };
  });

  return { results, method: "keyword_rule" };
}

/**
 * Update (upsert) today's SentimentSnapshot for a campaign
 * based on all analyzed tweets.
 */
export async function updateSentimentSnapshot(
  campaignId: string,
): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const counts = await prisma.monitorTweet.groupBy({
    by: ["sentiment"],
    where: { campaignId, sentiment: { not: null } },
    _count: true,
  });

  const avgResult = await prisma.monitorTweet.aggregate({
    where: { campaignId, sentimentScore: { not: null } },
    _avg: { sentimentScore: true },
    _count: true,
  });

  const positiveCount =
    counts.find((c) => c.sentiment === "positive")?._count ?? 0;
  const negativeCount =
    counts.find((c) => c.sentiment === "negative")?._count ?? 0;
  const neutralCount =
    counts.find((c) => c.sentiment === "neutral")?._count ?? 0;

  await prisma.sentimentSnapshot.upsert({
    where: { campaignId_date: { campaignId, date: today } },
    update: {
      positiveCount,
      negativeCount,
      neutralCount,
      avgScore: avgResult._avg.sentimentScore ?? 0,
      tweetCount: avgResult._count,
    },
    create: {
      campaignId,
      date: today,
      positiveCount,
      negativeCount,
      neutralCount,
      avgScore: avgResult._avg.sentimentScore ?? 0,
      tweetCount: avgResult._count,
    },
  });
}
