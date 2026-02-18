import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateTweet, generateTweetSuggestions } from "@/lib/openai";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { trackTokenUsage } from "@/lib/usage-tracking";
import { hasCredits, deductCredits, deductFlatFee, AGENT_FLAT_FEE_CENTS } from "@/lib/credits";
import {
  generateWithAgents,
  isAgentServiceConfigured,
} from "@/lib/agent-client";

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  if (!(await hasCredits(user.id))) {
    return NextResponse.json(
      { error: "Insufficient credits. Please add credits in Settings to continue using AI generation." },
      { status: 402 }
    );
  }

  const body = await request.json();
  const { prompt, multiple, language } = body;

  // Use agent service if configured
  if (isAgentServiceConfigured()) {
    try {
      const result = await generateWithAgents({
        userId: user.id,
        prompt,
        language,
        multiple,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      // Deduct flat fee for agent calls
      try {
        await deductFlatFee({ userId: user.id, feeCents: AGENT_FLAT_FEE_CENTS, source: "agent_generate" });
      } catch (error) {
        console.error("Failed to deduct credits (agent):", error);
      }

      if (multiple) {
        return NextResponse.json({
          suggestions: result.suggestions,
          media_asset_id: result.media_asset_id,
          pipeline_log: result.pipeline_log,
        });
      }

      return NextResponse.json({
        content: result.content,
        media_asset_id: result.media_asset_id,
        pipeline_log: result.pipeline_log,
      });
    } catch (error) {
      console.error("Agent service error, falling back to direct OpenAI:", error);
      // Fall through to direct OpenAI below
    }
  }

  // Fallback: direct OpenAI generation
  const sources = await prisma.knowledgeSource.findMany({
    where: { isActive: true, userId: user.id },
  });
  type KnowledgeSource = (typeof sources)[number];

  if (sources.length === 0) {
    return NextResponse.json(
      {
        error:
          "No knowledge sources found. Please add at least one website to your knowledge base.",
      },
      { status: 400 }
    );
  }

  const knowledgeContext = sources
    .map((source: KnowledgeSource) => {
      const truncatedContent =
        source.content.length > 2000
          ? source.content.substring(0, 2000) + "..."
          : source.content;
      return `Source: ${source.name} (${source.url})\n${truncatedContent}`;
    })
    .join("\n\n---\n\n");

  if (multiple) {
    const result = await generateTweetSuggestions(
      knowledgeContext,
      prompt,
      3,
      language
    );

    if (result.usage) {
      try {
        await trackTokenUsage({
          userId: user.id,
          source: "generate_api_suggestions",
          usage: result.usage,
          model: result.model,
          metadata: { multiple: true },
        });
        await deductCredits({ userId: user.id, usage: result.usage, model: result.model, source: "generate_api_suggestions" });
      } catch (error) {
        console.error("Failed to track usage/deduct credits (suggestions):", error);
      }
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ suggestions: result.suggestions });
  } else {
    const result = await generateTweet(knowledgeContext, prompt, language);

    if (result.usage) {
      try {
        await trackTokenUsage({
          userId: user.id,
          source: "generate_api_single",
          usage: result.usage,
          model: result.model,
          metadata: { multiple: false },
        });
        await deductCredits({ userId: user.id, usage: result.usage, model: result.model, source: "generate_api_single" });
      } catch (error) {
        console.error("Failed to track usage/deduct credits (single):", error);
      }
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ content: result.content });
  }
}
