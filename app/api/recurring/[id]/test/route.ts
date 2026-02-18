import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getUserXCredentials } from "@/lib/user-credentials";
import { generateTweet } from "@/lib/openai";
import { trackTokenUsage } from "@/lib/usage-tracking";
import { hasCredits, deductCredits } from "@/lib/credits";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;

  const schedule = await prisma.recurringSchedule.findFirst({
    where: { id, userId: user.id },
  });

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  const resolved = await getUserXCredentials(user.id, schedule.xAccountId);
  if (!resolved) {
    return NextResponse.json(
      { error: "X API credentials not configured for this schedule account." },
      { status: 400 }
    );
  }

  if (schedule.useAi && !(await hasCredits(user.id))) {
    return NextResponse.json(
      { error: "Insufficient credits. Please add credits in Settings to continue using AI generation." },
      { status: 402 }
    );
  }

  if (!schedule.useAi) {
    return NextResponse.json({
      success: true,
      mode: "fixed",
      content: schedule.content,
    });
  }

  const sources = await prisma.knowledgeSource.findMany({
    where: { isActive: true, userId: user.id },
  });

  if (sources.length === 0) {
    return NextResponse.json(
      { error: "No knowledge sources found for AI schedule test." },
      { status: 400 }
    );
  }

  const knowledgeContext = sources
    .map((source) => {
      const truncatedContent =
        source.content.length > 2000
          ? source.content.substring(0, 2000) + "..."
          : source.content;
      return `Source: ${source.name} (${source.url})\n${truncatedContent}`;
    })
    .join("\n\n---\n\n");

  const generated = await generateTweet(
    knowledgeContext,
    schedule.aiPrompt || undefined,
    schedule.aiLanguage || undefined
  );

  if (generated.usage) {
    try {
      await trackTokenUsage({
        userId: user.id,
        source: "recurring_item_test",
        usage: generated.usage,
        model: generated.model,
        metadata: { scheduleId: schedule.id },
      });
      await deductCredits({
        userId: user.id,
        usage: generated.usage,
        model: generated.model,
        source: "recurring_item_test",
      });
    } catch (error) {
      console.error("Failed to track/deduct recurring item test usage:", error);
    }
  }

  if (!generated.success || !generated.content) {
    return NextResponse.json(
      { error: generated.error || "Failed to generate sample content." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    mode: "ai",
    content: generated.content,
  });
}
