import { getOpenAIClient } from "./openai";
import type { TokenUsage } from "./usage-tracking";

export interface HashtagResult {
  success: boolean;
  content: string;
  hashtags: string[];
  usage?: TokenUsage;
  error?: string;
}

/**
 * Given a tweet and a list of trending topic names, use AI to pick
 * the 1-2 most relevant hashtags and append them to the tweet
 * while staying under 280 characters.
 */
export async function optimizeHashtags(
  content: string,
  trendingTopics: string[],
): Promise<HashtagResult> {
  if (trendingTopics.length === 0) {
    return { success: true, content, hashtags: [] };
  }

  try {
    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a hashtag optimization expert for X (Twitter). Given a tweet and a list of trending topics, pick the 1-2 most relevant hashtags to append.

Rules:
- Only pick hashtags that are GENUINELY relevant to the tweet content
- Return ONLY the hashtags (e.g. "#AI #Tech"), nothing else
- If no trending topic is relevant, return "NONE"
- Format as hashtags with # prefix
- Keep it to 1-2 hashtags maximum`,
        },
        {
          role: "user",
          content: `Tweet: "${content}"

Trending topics: ${trendingTopics.map((t) => `"${t}"`).join(", ")}

Pick the most relevant 1-2 hashtags:`,
        },
      ],
      max_tokens: 50,
      temperature: 0.3,
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const usage: TokenUsage | undefined = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens ?? 0,
          completionTokens: response.usage.completion_tokens ?? 0,
          totalTokens: response.usage.total_tokens ?? 0,
        }
      : undefined;

    if (!raw || raw === "NONE") {
      return { success: true, content, hashtags: [], usage };
    }

    // Extract hashtags from response
    const hashtags = raw
      .split(/\s+/)
      .filter((w) => w.startsWith("#") && w.length > 1)
      .slice(0, 2);

    if (hashtags.length === 0) {
      return { success: true, content, hashtags: [], usage };
    }

    // Append hashtags if they fit within 280 chars
    const suffix = "\n\n" + hashtags.join(" ");
    const enhanced =
      content.length + suffix.length <= 280 ? content + suffix : content;

    return {
      success: true,
      content: enhanced,
      hashtags,
      usage,
    };
  } catch (error) {
    // Non-fatal: return original content if hashtag optimization fails
    return {
      success: false,
      content,
      hashtags: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
