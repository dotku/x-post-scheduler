import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, apiError } from "@/lib/api-auth";
import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { resolveTextModel, TEXT_MODELS } from "@/lib/ai-models";
import { deductCredits, getCreditBalance } from "@/lib/credits";
import { trackTokenUsage } from "@/lib/usage-tracking";

/** POST /api/v1/text/generate — text generation */
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request.headers.get("authorization"));
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const {
    model: modelId,
    prompt,
    system,
    max_tokens: maxTokens,
    temperature,
  } = body as {
    model?: string;
    prompt: string;
    system?: string;
    max_tokens?: number;
    temperature?: number;
  };

  if (!prompt?.trim()) {
    return apiError("prompt is required", 400, "INVALID_PARAMS");
  }

  const model = resolveTextModel(modelId);

  // Check balance (rough estimate: 10 cents minimum)
  const balanceCents = await getCreditBalance(auth.userId);
  if (balanceCents <= 0) {
    return apiError(
      "Insufficient credits",
      402,
      "INSUFFICIENT_CREDITS",
    );
  }

  try {
    const result = await generateText({
      model: gateway(model.id),
      system: system || undefined,
      prompt,
      maxOutputTokens: maxTokens ?? 1000,
      temperature: temperature ?? 0.7,
    });

    const content = result.text?.trim();
    if (!content) {
      return apiError("No content generated", 500, "GENERATION_FAILED");
    }

    const usage = {
      promptTokens: result.usage.inputTokens ?? 0,
      completionTokens: result.usage.outputTokens ?? 0,
      totalTokens:
        (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
    };

    // Deduct credits + track usage
    let costCents = 0;
    try {
      const deductResult = await deductCredits({
        userId: auth.userId,
        usage,
        model: model.id,
        source: "api_v1_text_generate",
      });
      costCents = deductResult.costCents;
    } catch (err) {
      console.error("Failed to deduct text credits:", err);
    }

    try {
      await trackTokenUsage({
        userId: auth.userId,
        source: "api_v1_text_generate",
        usage,
        model: model.id,
        metadata: { apiKeyId: auth.apiKeyId },
      });
    } catch (err) {
      console.error("Failed to track text usage:", err);
    }

    const remainingCents = await getCreditBalance(auth.userId);

    return NextResponse.json({
      content,
      model: model.id,
      usage: {
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
      },
      cost_cents: costCents,
      remaining_credits_cents: remainingCents,
    });
  } catch (error) {
    console.error("API v1 text generate error:", error);
    return apiError(
      error instanceof Error ? error.message : "Generation failed",
      500,
      "GENERATION_FAILED",
    );
  }
}
