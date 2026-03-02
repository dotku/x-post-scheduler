import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { resolveTextModel } from "./ai-models";
import { TwitterApi } from "twitter-api-v2";
import type { XCredentials } from "./x-client";
import type { TokenUsage } from "./usage-tracking";

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface SearchedTweet {
  id: string;
  text: string;
  authorUsername: string;
  authorName: string;
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  impressionCount: number;
}

export interface SentimentScores {
  positive: number; // percentage 0-100
  negative: number;
  neutral: number;
}

export interface SentimentResult {
  success: boolean;
  sentimentData?: SentimentScores;
  themes?: string[];
  topTweets?: Array<SearchedTweet & { sentiment: string }>;
  aiSummary?: string;
  tweetCount?: number;
  usage?: TokenUsage;
  modelId?: string;
  error?: string;
}

// ── X API Search ─────────────────────────────────────────────────────────────

export async function searchRecentTweets(
  keywords: string[],
  credentials: XCredentials,
  maxResults = 100,
): Promise<{ tweets: SearchedTweet[]; query: string }> {
  const queryParts = keywords.map((k) =>
    k.startsWith("#") || k.startsWith("$") ? k : `"${k}"`,
  );
  const query = queryParts.join(" OR ") + " -is:retweet lang:en";

  const client = new TwitterApi({
    appKey: credentials.apiKey || process.env.X_API_KEY || "",
    appSecret: credentials.apiSecret || process.env.X_API_SECRET || "",
    accessToken: credentials.accessToken,
    accessSecret: credentials.accessTokenSecret,
  });

  const result = await client.v2.search(query, {
    max_results: Math.min(maxResults, 100),
    "tweet.fields": ["created_at", "public_metrics", "author_id"],
    "user.fields": ["username", "name"],
    expansions: ["author_id"],
  });

  const users = new Map(
    (result.includes?.users ?? []).map((u) => [
      u.id,
      { username: u.username, name: u.name },
    ]),
  );

  const tweets: SearchedTweet[] = [];
  for (const tweet of result.data?.data ?? []) {
    const author = users.get(tweet.author_id ?? "") ?? {
      username: "unknown",
      name: "Unknown",
    };
    tweets.push({
      id: tweet.id,
      text: tweet.text,
      authorUsername: author.username,
      authorName: author.name,
      createdAt: tweet.created_at ?? new Date().toISOString(),
      likeCount: tweet.public_metrics?.like_count ?? 0,
      retweetCount: tweet.public_metrics?.retweet_count ?? 0,
      replyCount: tweet.public_metrics?.reply_count ?? 0,
      impressionCount: tweet.public_metrics?.impression_count ?? 0,
    });
  }

  return { tweets, query };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Escape control characters only inside JSON string values (not structural whitespace). */
function sanitizeJsonControlChars(raw: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escaped = true;
      result += ch;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString && ch.charCodeAt(0) <= 0x1f) {
      if (ch === "\n") { result += "\\n"; continue; }
      if (ch === "\r") { result += "\\r"; continue; }
      if (ch === "\t") { result += "\\t"; continue; }
      continue; // strip other control chars
    }
    result += ch;
  }
  return result;
}

// ── AI Sentiment Analysis ────────────────────────────────────────────────────

export async function analyzeSentiment(
  tweets: SearchedTweet[],
  topicName: string,
  keywords: string[],
  modelId?: string,
  locale?: string,
): Promise<SentimentResult> {
  if (tweets.length === 0) {
    return { success: false, error: "No tweets found for analysis" };
  }

  const model = resolveTextModel(modelId);
  const lang = locale === "zh" ? "Chinese (简体中文)" : "English";

  const tweetContext = tweets
    .slice(0, 50)
    .map(
      (t, i) =>
        `${i + 1}. @${t.authorUsername}: "${t.text}" [Likes: ${t.likeCount}, RT: ${t.retweetCount}]`,
    )
    .join("\n");

  const systemPrompt = `You are an expert social media analyst specializing in sentiment analysis and public opinion monitoring (舆情分析). Analyze the following tweets about "${topicName}" (keywords: ${keywords.join(", ")}).

You MUST write your entire response in ${lang}.

Return your analysis as valid JSON only — no markdown, no code fences, no extra text.

JSON structure:
{
  "sentiment": { "positive": <0-100>, "negative": <0-100>, "neutral": <0-100> },
  "themes": ["theme1", "theme2", ...],
  "topTweets": [
    { "index": <1-based index from input>, "sentiment": "positive|negative|neutral", "reason": "brief reason" }
  ],
  "summary": "A comprehensive 2-3 paragraph analysis of public sentiment..."
}

Guidelines:
- sentiment percentages must sum to 100
- Identify 3-8 major themes/talking points
- Select 5-10 most notable/representative tweets for topTweets
- summary should cover: overall mood, key talking points, notable shifts, actionable insights
- For election topics: compare sentiment across candidates/parties if applicable
- For financial topics: highlight bullish/bearish signals and market mood`;

  try {
    const result = await generateText({
      model: gateway(model.id),
      system: systemPrompt,
      prompt: `Analyze these ${tweets.length} tweets:\n\n${tweetContext}`,
      maxOutputTokens: 2000,
      temperature: 0.3,
    });

    const text = result.text?.trim();
    if (!text) {
      return { success: false, error: "No analysis generated", modelId: model.id };
    }

    const jsonStr = text
      .replace(/^```(?:json)?\s*/, "")
      .replace(/\s*```$/, "");
    const parsed = JSON.parse(sanitizeJsonControlChars(jsonStr));

    const topTweetsFull = (
      parsed.topTweets ?? []
    )
      .map((t: { index: number; sentiment: string }) => {
        const tweet = tweets[t.index - 1];
        return tweet ? { ...tweet, sentiment: t.sentiment } : null;
      })
      .filter(Boolean);

    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;

    return {
      success: true,
      sentimentData: parsed.sentiment,
      themes: parsed.themes,
      topTweets: topTweetsFull,
      aiSummary: parsed.summary,
      tweetCount: tweets.length,
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      modelId: model.id,
    };
  } catch (error) {
    console.error("[sentiment-monitor] Analysis error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Analysis failed",
      modelId: model.id,
    };
  }
}

// ── Demo Templates ───────────────────────────────────────────────────────────

export interface DemoTemplate {
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  keywords: string[];
  category: "election" | "finance";
}

export const DEMO_TEMPLATES: DemoTemplate[] = [
  // Election
  {
    name: "2026 US Midterm Elections",
    nameZh: "2026 美国中期选举",
    description: "Track public sentiment around the 2026 midterm elections",
    descriptionZh: "追踪2026年中期选举的公众舆论",
    keywords: ["midterm 2026", "#Election2026", "#Midterms2026", "Senate race", "House race"],
    category: "election",
  },
  {
    name: "US Political Figures",
    nameZh: "美国政治人物",
    description: "Compare sentiment between major political figures",
    descriptionZh: "对比主要政治人物的舆论情感",
    keywords: ["Trump", "Biden", "DeSantis", "#MAGA", "#Democrat"],
    category: "election",
  },
  // Finance
  {
    name: "Stock Market Sentiment",
    nameZh: "股市舆情",
    description: "Monitor investor sentiment on major stocks and indices",
    descriptionZh: "监控投资者对主要股票和指数的情感",
    keywords: ["$SPY", "$AAPL", "$TSLA", "#StockMarket", "Fed rate", "bull market", "bear market"],
    category: "finance",
  },
  {
    name: "Crypto Market Pulse",
    nameZh: "加密货币市场脉搏",
    description: "Track crypto community sentiment and trending narratives",
    descriptionZh: "追踪加密社区情感和热门叙事",
    keywords: ["$BTC", "$ETH", "#Bitcoin", "#Ethereum", "#Crypto", "DeFi", "altcoin"],
    category: "finance",
  },
  {
    name: "Tech Earnings Watch",
    nameZh: "科技财报观察",
    description: "Monitor reactions to tech company earnings and announcements",
    descriptionZh: "监控科技公司财报和公告的市场反应",
    keywords: ["NVIDIA earnings", "Apple earnings", "Microsoft earnings", "#TechEarnings", "AI stocks"],
    category: "finance",
  },
];
