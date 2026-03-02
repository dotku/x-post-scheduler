import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { trackTokenUsage } from "@/lib/usage-tracking";
import { hasCredits, deductCredits, deductFlatFee, AGENT_FLAT_FEE_CENTS } from "@/lib/credits";
import {
  generateWithAgents,
  isAgentServiceConfigured,
} from "@/lib/agent-client";
import {
  generateTweetViaGateway,
  generateSuggestionsViaGateway,
} from "@/lib/ai-gateway";
import { getContentProfile } from "@/lib/content-profile";

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
  const { prompt, multiple, language, model: modelId } = body;

  // Use agent service if configured (no model selection — agent handles routing)
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
      console.error("Agent service error, falling back to AI Gateway:", error);
      // Fall through to AI Gateway below
    }
  }

  // AI Gateway generation (supports multiple providers)
  const [sources, recentPostsRows, profileData] = await Promise.all([
    prisma.knowledgeSource.findMany({
      where: { isActive: true, userId: user.id },
    }),
    prisma.post.findMany({
      where: { userId: user.id, status: "posted" },
      orderBy: { postedAt: "desc" },
      take: 5,
      select: { content: true },
    }),
    getContentProfile(user.id),
  ]);
  const recentPosts = recentPostsRows.map((p) => p.content);
  const contentProfile = profileData.profile ?? undefined;
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
    const result = await generateSuggestionsViaGateway({
      knowledgeContext,
      prompt,
      count: 3,
      language,
      recentPosts,
      modelId,
      contentProfile,
    });

    if (result.usage) {
      try {
        await trackTokenUsage({
          userId: user.id,
          source: "generate_api_suggestions",
          usage: result.usage,
          model: result.modelId,
          metadata: { multiple: true },
        });
        await deductCredits({ userId: user.id, usage: result.usage, model: result.modelId, source: "generate_api_suggestions" });
      } catch (error) {
        console.error("Failed to track usage/deduct credits (suggestions):", error);
      }
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ suggestions: result.suggestions });
  } else {
    const result = await generateTweetViaGateway({
      knowledgeContext,
      prompt,
      language,
      recentPosts,
      modelId,
      contentProfile,
    });

    if (result.usage) {
      try {
        await trackTokenUsage({
          userId: user.id,
          source: "generate_api_single",
          usage: result.usage,
          model: result.modelId,
          metadata: { multiple: false },
        });
        await deductCredits({ userId: user.id, usage: result.usage, model: result.modelId, source: "generate_api_single" });
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
