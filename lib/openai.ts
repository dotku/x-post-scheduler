import OpenAI from "openai";
import type { TokenUsage } from "./usage-tracking";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY. Please set it in your .env.local file."
    );
  }

  return new OpenAI({ apiKey });
}

export interface GenerateResult {
  success: boolean;
  content?: string;
  error?: string;
  usage?: TokenUsage;
  model?: string;
}

const INFLUENCER_STRATEGY = `
## Influencer Content Strategy (apply these principles):
- **Hook first**: Open with a bold statement, surprising fact, or direct question — the first line must stop the scroll.
- **Vary content type**: Rotate between formats — tips/how-to, personal opinion, data/insight, behind-the-scenes, question to audience, hot take, story/anecdote.
- **Avoid repetition**: Do NOT repeat recent post topics, angles, or opening styles. Each post must feel fresh.
- **Conversational tone**: Write like a knowledgeable human, not a press release. Short sentences. Direct.
- **Value density**: Pack one clear idea per tweet. No filler.
- **Soft CTA when natural**: End with a question or invitation to engage (reply, share, follow) only if it flows naturally.
- **No clichés**: Avoid "I'm excited to share", "Game changer", "In today's world", "Let's dive in".
`;

// Generate a tweet based on knowledge context and optional prompt
export async function generateTweet(
  knowledgeContext: string,
  prompt?: string,
  language?: string,
  recentPosts?: string[]
): Promise<GenerateResult> {
  try {
    const client = getOpenAIClient();

    const languageInstruction = language
      ? `IMPORTANT: Generate the tweet in ${language}.`
      : `IMPORTANT: Detect the language of the knowledge base content and generate the tweet in the SAME language. If the content is in Chinese, respond in Chinese. If in English, respond in English. Match the language of the source content.`;

    const recentPostsSection = recentPosts && recentPosts.length > 0
      ? `\n## Recent posts (DO NOT repeat these topics, angles, or opening styles):\n${recentPosts.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n`
      : "";

    const systemPrompt = `You are a social media expert who creates engaging tweets for X (formerly Twitter).

${languageInstruction}

${INFLUENCER_STRATEGY}

Rules:
- Keep tweets under 280 characters (STRICT LIMIT)
- Be engaging, informative, and authentic
- Use relevant hashtags sparingly (1-2 max)
- Don't use excessive emojis (1-2 max if appropriate)
- Make the content feel natural, not robotic
- Focus on providing value to the reader
- ALWAYS match the language of the knowledge base content
${recentPostsSection}
## Knowledge base content:
${knowledgeContext}

Generate tweets that are relevant to this knowledge base content.`;

    const userPrompt = prompt
      ? `Generate a tweet about: ${prompt}`
      : "Generate an engaging tweet based on the knowledge base content. Pick an interesting topic or fact to share.";

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 150,
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
      return {
        success: false,
        error: "No content generated",
        usage,
        model: response.model,
      };
    }

    // Ensure content is under 280 characters
    const finalContent =
      content.length > 280 ? content.substring(0, 277) + "..." : content;

    return {
      success: true,
      content: finalContent,
      usage,
      model: response.model,
    };
  } catch (error) {
    console.error("Error generating tweet:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// Generate multiple tweet suggestions
export async function generateTweetSuggestions(
  knowledgeContext: string,
  prompt?: string,
  count: number = 3,
  language?: string,
  recentPosts?: string[]
): Promise<{
  success: boolean;
  suggestions?: string[];
  error?: string;
  usage?: TokenUsage;
  model?: string;
}> {
  try {
    const client = getOpenAIClient();

    const languageInstruction = language
      ? `IMPORTANT: Generate all tweets in ${language}.`
      : `IMPORTANT: Detect the language of the knowledge base content and generate all tweets in the SAME language. If the content is in Chinese, respond in Chinese. If in English, respond in English. Match the language of the source content.`;

    const recentPostsSection = recentPosts && recentPosts.length > 0
      ? `\n## Recent posts (DO NOT repeat these topics, angles, or opening styles):\n${recentPosts.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n`
      : "";

    const systemPrompt = `You are a social media expert who creates engaging tweets for X (formerly Twitter).

${languageInstruction}

${INFLUENCER_STRATEGY}

Rules:
- Keep each tweet under 280 characters (STRICT LIMIT)
- Be engaging, informative, and authentic
- Use relevant hashtags sparingly (1-2 max per tweet)
- Don't use excessive emojis (1-2 max if appropriate)
- Make the content feel natural, not robotic
- Each tweet should have a DIFFERENT angle, format, and opening style
- ALWAYS match the language of the knowledge base content
${recentPostsSection}
## Knowledge base content:
${knowledgeContext}

Generate ${count} different tweet options, each on a new line. Just the tweet text, no numbering or labels.`;

    const userPrompt = prompt
      ? `Generate ${count} different tweets about: ${prompt}`
      : `Generate ${count} different engaging tweets based on the knowledge base content.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 500,
      temperature: 0.9,
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
      return {
        success: false,
        error: "No content generated",
        usage,
        model: response.model,
      };
    }

    // Split by newlines and filter empty lines
    const suggestions = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.length <= 280)
      .slice(0, count);

    return {
      success: true,
      suggestions,
      usage,
      model: response.model,
    };
  } catch (error) {
    console.error("Error generating suggestions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
