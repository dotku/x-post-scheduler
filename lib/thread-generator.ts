import { getOpenAIClient } from "./openai";
import type { TokenUsage } from "./usage-tracking";

export interface ThreadGenerateResult {
  success: boolean;
  tweets?: string[];
  usage?: TokenUsage;
  model?: string;
  error?: string;
}

/**
 * Generate a 3-7 tweet thread from knowledge base content.
 */
export async function generateThread(params: {
  knowledgeContext: string;
  prompt?: string;
  language?: string;
  contentProfile?: string;
  recentPosts?: string[];
  count?: number;
}): Promise<ThreadGenerateResult> {
  const threadSize = Math.min(7, Math.max(3, params.count ?? 5));

  const languageInstruction = params.language
    ? `IMPORTANT: Write the entire thread in ${params.language}.`
    : `IMPORTANT: Match the language of the knowledge base content.`;

  const profileSection = params.contentProfile
    ? `\n## Content Profile (apply these insights):\n${params.contentProfile}\n`
    : "";

  const recentPostsSection =
    params.recentPosts && params.recentPosts.length > 0
      ? `\n## Recent posts (avoid repeating):\n${params.recentPosts.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n`
      : "";

  const systemPrompt = `You are a social media expert who creates engaging Twitter/X threads.

${languageInstruction}
${profileSection}
Rules:
- Create exactly ${threadSize} tweets for the thread
- Each tweet MUST be under 280 characters (STRICT LIMIT)
- Tweet 1: Strong hook that makes people want to read the whole thread
- Middle tweets: Deliver value with one clear point each
- Last tweet: Summarize or call to action
- Use "1/" style numbering at the start of each tweet
- Make each tweet standalone-readable but part of a narrative
- No excessive hashtags or emojis
${recentPostsSection}
## Knowledge base content:
${params.knowledgeContext}

Output each tweet on its own line, separated by blank lines. Just the tweet text with numbering.`;

  const userPrompt = params.prompt
    ? `Create a ${threadSize}-tweet thread about: ${params.prompt}`
    : `Create a ${threadSize}-tweet thread based on the most interesting topic from the knowledge base.`;

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1200,
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const usage: TokenUsage | undefined = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens ?? 0,
          completionTokens: response.usage.completion_tokens ?? 0,
          totalTokens: response.usage.total_tokens ?? 0,
        }
      : undefined;

    if (!content) {
      return { success: false, error: "No thread generated", usage };
    }

    // Parse tweets: split by blank lines or numbered patterns
    const tweets = content
      .split(/\n\s*\n/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 280)
      .slice(0, threadSize);

    if (tweets.length < 2) {
      return {
        success: false,
        error: "Failed to generate enough thread tweets",
        usage,
      };
    }

    return {
      success: true,
      tweets,
      usage,
      model: response.model,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
