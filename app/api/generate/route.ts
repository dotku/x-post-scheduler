import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateTweet, generateTweetSuggestions } from "@/lib/openai";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
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

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ suggestions: result.suggestions });
  } else {
    const result = await generateTweet(knowledgeContext, prompt, language);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ content: result.content });
  }
}
