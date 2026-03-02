/**
 * AI Gateway — unified text generation wrapper using Vercel AI SDK.
 * Routes requests through the AI Gateway to any supported provider
 * (OpenAI, Anthropic, Google, xAI, Mistral…).
 *
 * Infrastructure provider names (Vercel, etc.) are NOT exposed externally.
 */
import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { resolveTextModel } from "./ai-models";
import type { TokenUsage } from "./usage-tracking";

export interface GatewayGenerateResult {
  success: boolean;
  content?: string;
  error?: string;
  usage?: TokenUsage;
  modelId?: string;
}

export interface GatewaySuggestionsResult {
  success: boolean;
  suggestions?: string[];
  error?: string;
  usage?: TokenUsage;
  modelId?: string;
}

// ---------------------------------------------------------------------------
// Shared prompt builders (mirrors lib/openai.ts logic)
// ---------------------------------------------------------------------------

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

function buildSystemPrompt(
  knowledgeContext: string,
  language?: string,
  recentPosts?: string[],
  count?: number,
  contentProfile?: string,
): string {
  const languageInstruction = language
    ? `IMPORTANT: Generate the tweet${count && count > 1 ? "s" : ""} in ${language}.`
    : `IMPORTANT: Detect the language of the knowledge base content and generate the tweet${count && count > 1 ? "s" : ""} in the SAME language. If the content is in Chinese, respond in Chinese. If in English, respond in English. Match the language of the source content.`;

  const recentPostsSection =
    recentPosts && recentPosts.length > 0
      ? `\n## Recent posts (DO NOT repeat these topics, angles, or opening styles):\n${recentPosts.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n`
      : "";

  const contentProfileSection = contentProfile
    ? `\n## Your Content Profile (based on past performance data — apply these insights):\n${contentProfile}\n`
    : "";

  if (count && count > 1) {
    return `You are a social media expert who creates engaging tweets for X (formerly Twitter).

${languageInstruction}

${INFLUENCER_STRATEGY}
${contentProfileSection}
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
  }

  return `You are a social media expert who creates engaging tweets for X (formerly Twitter).

${languageInstruction}

${INFLUENCER_STRATEGY}
${contentProfileSection}
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
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Generate a single tweet via the AI Gateway. */
export async function generateTweetViaGateway(params: {
  knowledgeContext: string;
  prompt?: string;
  language?: string;
  recentPosts?: string[];
  modelId?: string;
  contentProfile?: string;
}): Promise<GatewayGenerateResult> {
  const model = resolveTextModel(params.modelId);
  try {
    const result = await generateText({
      model: gateway(model.id),
      system: buildSystemPrompt(
        params.knowledgeContext,
        params.language,
        params.recentPosts,
        undefined,
        params.contentProfile,
      ),
      prompt: params.prompt
        ? `Generate a tweet about: ${params.prompt}`
        : "Generate an engaging tweet based on the knowledge base content. Pick an interesting topic or fact to share.",
      maxOutputTokens: 150,
      temperature: 0.8,
    });

    const content = result.text?.trim();
    if (!content) {
      return { success: false, error: "No content generated", modelId: model.id };
    }

    const finalContent =
      content.length > 280 ? content.substring(0, 277) + "..." : content;

    const inputTokens = result.usage.inputTokens ?? 0;
    const outputTokens = result.usage.outputTokens ?? 0;
    return {
      success: true,
      content: finalContent,
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      modelId: model.id,
    };
  } catch (error) {
    console.error("AI Gateway generate error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      modelId: model.id,
    };
  }
}

/** Generate multiple tweet suggestions via the AI Gateway. */
export async function generateSuggestionsViaGateway(params: {
  knowledgeContext: string;
  prompt?: string;
  count?: number;
  language?: string;
  recentPosts?: string[];
  modelId?: string;
  contentProfile?: string;
}): Promise<GatewaySuggestionsResult> {
  const model = resolveTextModel(params.modelId);
  const count = params.count ?? 3;
  try {
    const result = await generateText({
      model: gateway(model.id),
      system: buildSystemPrompt(
        params.knowledgeContext,
        params.language,
        params.recentPosts,
        count,
        params.contentProfile,
      ),
      prompt: params.prompt
        ? `Generate ${count} different tweets about: ${params.prompt}`
        : `Generate ${count} different engaging tweets based on the knowledge base content.`,
      maxOutputTokens: 500,
      temperature: 0.9,
    });

    const content = result.text?.trim();
    if (!content) {
      return { success: false, error: "No content generated", modelId: model.id };
    }

    const suggestions = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.length <= 280)
      .slice(0, count);

    const inputTokens2 = result.usage.inputTokens ?? 0;
    const outputTokens2 = result.usage.outputTokens ?? 0;
    return {
      success: true,
      suggestions,
      usage: {
        promptTokens: inputTokens2,
        completionTokens: outputTokens2,
        totalTokens: inputTokens2 + outputTokens2,
      },
      modelId: model.id,
    };
  } catch (error) {
    console.error("AI Gateway suggestions error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      modelId: model.id,
    };
  }
}

/** Generate a tweet for the landing page (no knowledge sources, direct prompt). */
export async function generateLandingTweetViaGateway(params: {
  topic: string;
  tone?: string;
  goal?: string;
  language?: string;
  modelId?: string;
}): Promise<GatewayGenerateResult> {
  const model = resolveTextModel(params.modelId);
  try {
    const result = await generateText({
      model: gateway(model.id),
      system: `You are a social media expert who writes engaging tweets for X (Twitter).
${params.language ? `IMPORTANT: Write in ${params.language}.` : ""}
Rules: Under 280 characters. Engaging and authentic. 1-2 hashtags max. 1-2 emojis max. No clichés.`,
      prompt: `Write a tweet about: ${params.topic}${params.tone ? `. Tone: ${params.tone}` : ""}${params.goal ? `. Goal: ${params.goal}` : ""}.`,
      maxOutputTokens: 150,
      temperature: 0.8,
    });

    const content = result.text?.trim();
    if (!content) {
      return { success: false, error: "No content generated", modelId: model.id };
    }

    const finalContent =
      content.length > 280 ? content.substring(0, 277) + "..." : content;

    const inputTokens3 = result.usage.inputTokens ?? 0;
    const outputTokens3 = result.usage.outputTokens ?? 0;
    return {
      success: true,
      content: finalContent,
      usage: {
        promptTokens: inputTokens3,
        completionTokens: outputTokens3,
        totalTokens: inputTokens3 + outputTokens3,
      },
      modelId: model.id,
    };
  } catch (error) {
    console.error("AI Gateway landing generate error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      modelId: model.id,
    };
  }
}
