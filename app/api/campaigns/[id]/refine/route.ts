import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { resolveTextModel } from "@/lib/ai-models";
import { hasCredits, deductCredits } from "@/lib/credits";
import { trackTokenUsage } from "@/lib/usage-tracking";

export const maxDuration = 60;

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

  try {
    const hasCreds = await hasCredits(user.id);
    if (!hasCreds) {
      return NextResponse.json(
        { error: "Insufficient credits" },
        { status: 402 }
      );
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
      select: { id: true, aiAnalysis: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await request.json();
    const { instruction, currentContent, locale: userLocale, modelId } = body;

    if (!instruction?.trim()) {
      return NextResponse.json({ error: "Instruction is required" }, { status: 400 });
    }

    const content = currentContent || campaign.aiAnalysis;
    if (!content) {
      return NextResponse.json({ error: "No analysis content to refine" }, { status: 400 });
    }

    const model = resolveTextModel(modelId);
    const langHint = userLocale === "zh" ? "Chinese (简体中文)" : "the same language as the content";

    const result = await generateText({
      model: gateway(model.id),
      system: `You are an expert advertising strategist assistant. The user has an existing campaign analysis and wants you to modify it based on their instruction.

Rules:
- Output ONLY the updated analysis in markdown format
- Keep the same overall structure and sections unless the user asks to change them
- Write in ${langHint}
- Do not add any preamble or explanation — output only the revised analysis`,
      prompt: `Here is the current campaign analysis:\n\n${content}\n\n---\n\nUser's instruction: ${instruction.trim()}`,
      maxOutputTokens: 2500,
      temperature: 0.6,
    });

    const refined = result.text?.trim();
    if (!refined) {
      return NextResponse.json({ error: "No refined content generated" }, { status: 500 });
    }

    const inputTokens = result.usage.inputTokens ?? 0;
    const outputTokens = result.usage.outputTokens ?? 0;
    const usage = {
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: inputTokens + outputTokens,
    };

    await deductCredits({
      userId: user.id,
      usage,
      model: model.id,
      source: "campaign-refine",
    });

    await trackTokenUsage({
      userId: user.id,
      source: "campaign-refine",
      model: model.id,
      usage,
    });

    await prisma.campaign.update({
      where: { id },
      data: {
        aiAnalysis: refined,
        aiAnalyzedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      analysis: refined,
      modelId: model.id,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[campaigns/refine] POST error:", errorMessage, error);
    return NextResponse.json(
      { error: `Failed to refine analysis: ${errorMessage}` },
      { status: 500 }
    );
  }
}
