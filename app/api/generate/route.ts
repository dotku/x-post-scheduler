import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateTweet, generateTweetSuggestions } from "@/lib/openai";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { prompt, multiple, language } = body;

  // Get all active knowledge sources
  const sources = await prisma.knowledgeSource.findMany({
    where: { isActive: true },
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

  // Combine knowledge from all sources (truncate to prevent token limits)
  const knowledgeContext = sources
    .map((source: KnowledgeSource) => {
      const truncatedContent =
        source.content.length > 2000
          ? source.content.substring(0, 2000) + "..."
          : source.content;
      return `Source: ${source.name} (${source.url})\n${truncatedContent}`;
    })
    .join("\n\n---\n\n");

  // Generate content
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
