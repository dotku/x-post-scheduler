import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, apiError } from "@/lib/api-auth";
import { submitImageTask, IMAGE_MODELS } from "@/lib/wavespeed";
import {
  deductWavespeedCredits,
  getCreditBalance,
  getWavespeedFeeCents,
} from "@/lib/credits";
import { trackWavespeedUsage } from "@/lib/usage-tracking";

/** POST /api/v1/image/generate — submit an image generation task */
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request.headers.get("authorization"));
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const {
    model: modelId,
    prompt,
    aspect_ratio: aspectRatio,
    mode,
    image_url: imageUrl,
    image_urls: imageUrls,
  } = body as {
    model: string;
    prompt: string;
    aspect_ratio?: string;
    mode?: "t2i" | "i2i" | "i2i_text";
    image_url?: string;
    image_urls?: string[];
  };

  if (!prompt?.trim()) {
    return apiError("prompt is required", 400, "INVALID_PARAMS");
  }
  if (!modelId?.trim()) {
    return apiError("model is required", 400, "INVALID_PARAMS");
  }

  if (!IMAGE_MODELS.find((m) => m.id === modelId)) {
    return apiError(`Invalid model: ${modelId}`, 400, "INVALID_MODEL");
  }

  const feeCents = getWavespeedFeeCents(modelId, "image");
  const balanceCents = await getCreditBalance(auth.userId);
  if (balanceCents < feeCents) {
    return apiError(
      `Insufficient credits. Need $${(feeCents / 100).toFixed(2)}, have $${(balanceCents / 100).toFixed(2)}`,
      402,
      "INSUFFICIENT_CREDITS",
    );
  }

  try {
    const task = await submitImageTask({
      modelId,
      prompt,
      aspectRatio,
      mode,
      imageUrl,
      imageUrls,
    });

    // Deduct credits
    try {
      await deductWavespeedCredits({
        userId: auth.userId,
        modelId,
        mediaType: "image",
        source: "api_v1_image_generate",
        taskId: task.id,
      });
    } catch (err) {
      console.error("Failed to deduct image credits:", err);
    }

    // Track usage
    try {
      await trackWavespeedUsage({
        userId: auth.userId,
        source: "api_v1_image_generate",
        model: modelId,
        prompt,
        metadata: { aspectRatio, mode, apiKeyId: auth.apiKeyId },
      });
    } catch (err) {
      console.error("Failed to track image usage:", err);
    }

    const remainingCents = await getCreditBalance(auth.userId);

    // For sync models, the task may already be complete
    if (task.status === "completed" && task.outputs?.length) {
      return NextResponse.json({
        task_id: task.id,
        status: "completed",
        outputs: task.outputs,
        cost_cents: feeCents,
        remaining_credits_cents: remainingCents,
      });
    }

    // Async task — return poll URL
    return NextResponse.json({
      task_id: task.id,
      status: task.status,
      poll_url: `/api/v1/video/${task.id}${task.urls?.get ? `?pollUrl=${encodeURIComponent(task.urls.get)}` : ""}`,
      cost_cents: feeCents,
      remaining_credits_cents: remainingCents,
    });
  } catch (error) {
    console.error("API v1 image generate error:", error);
    return apiError(
      error instanceof Error ? error.message : "Failed to submit task",
      500,
      "GENERATION_FAILED",
    );
  }
}
