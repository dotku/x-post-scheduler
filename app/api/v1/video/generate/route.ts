import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, apiError } from "@/lib/api-auth";
import { VIDEO_MODELS, I2V_MODELS } from "@/lib/wavespeed";
import { SEEDANCE_VIDEO_MODELS, SEEDANCE_I2V_MODELS } from "@/lib/seedance";
import { submitVideo, detectVideoProvider } from "@/lib/video-provider";
import {
  deductWavespeedCredits,
  getCreditBalance,
  getWavespeedFeeCents,
} from "@/lib/credits";
import { trackWavespeedUsage } from "@/lib/usage-tracking";

/** POST /api/v1/video/generate — submit a video generation task */
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request.headers.get("authorization"));
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const {
    model: modelId,
    prompt,
    duration,
    aspect_ratio: aspectRatio,
    image_url: imageUrl,
    generate_audio: generateAudio,
    lock_camera: lockCamera,
  } = body as {
    model: string;
    prompt: string;
    duration?: number;
    aspect_ratio?: string;
    image_url?: string;
    generate_audio?: boolean;
    lock_camera?: boolean;
  };

  if (!prompt?.trim()) {
    return apiError("prompt is required", 400, "INVALID_PARAMS");
  }
  if (!modelId?.trim()) {
    return apiError("model is required", 400, "INVALID_PARAMS");
  }

  const allModels = [...VIDEO_MODELS, ...I2V_MODELS, ...SEEDANCE_VIDEO_MODELS, ...SEEDANCE_I2V_MODELS];
  if (!allModels.find((m) => m.id === modelId)) {
    return apiError(`Invalid model: ${modelId}`, 400, "INVALID_MODEL");
  }

  const feeCents = getWavespeedFeeCents(modelId, "video");
  const balanceCents = await getCreditBalance(auth.userId);
  if (balanceCents < feeCents) {
    return apiError(
      `Insufficient credits. Need $${(feeCents / 100).toFixed(2)}, have $${(balanceCents / 100).toFixed(2)}`,
      402,
      "INSUFFICIENT_CREDITS",
    );
  }

  try {
    const provider = detectVideoProvider(modelId);
    const task = await submitVideo({
      modelId,
      prompt,
      duration,
      aspectRatio,
      imageUrl,
      generateAudio,
      lockCamera,
    });

    // Deduct credits
    try {
      await deductWavespeedCredits({
        userId: auth.userId,
        modelId,
        mediaType: "video",
        source: "api_v1_video_generate",
        taskId: task.id,
      });
    } catch (err) {
      console.error("Failed to deduct video credits:", err);
    }

    // Track usage
    try {
      await trackWavespeedUsage({
        userId: auth.userId,
        source: "api_v1_video_generate",
        model: modelId,
        prompt,
        metadata: {
          duration: duration ?? 5,
          aspectRatio: aspectRatio ?? "16:9",
          apiKeyId: auth.apiKeyId,
        },
      });
    } catch (err) {
      console.error("Failed to track video usage:", err);
    }

    const remainingCents = await getCreditBalance(auth.userId);

    // Build poll_url based on provider
    const pollParams = new URLSearchParams();
    pollParams.set("provider", provider);
    if (provider === "wavespeed" && task.urls?.get) {
      pollParams.set("pollUrl", task.urls.get);
    }

    return NextResponse.json({
      task_id: task.id,
      status: task.status,
      provider,
      poll_url: `/api/v1/video/${task.id}?${pollParams.toString()}`,
      cost_cents: feeCents,
      remaining_credits_cents: remainingCents,
    });
  } catch (error) {
    console.error("API v1 video generate error:", error);
    return apiError(
      error instanceof Error ? error.message : "Failed to submit task",
      500,
      "GENERATION_FAILED",
    );
  }
}
