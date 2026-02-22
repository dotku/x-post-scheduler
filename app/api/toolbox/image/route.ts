import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { submitImageTask, IMAGE_MODELS } from "@/lib/wavespeed";
import { trackWavespeedUsage } from "@/lib/usage-tracking";
import { deductWavespeedCredits, getCreditBalance, getWavespeedFeeCents } from "@/lib/credits";

export async function POST(request: NextRequest) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const { modelId, prompt, aspectRatio } = body as {
    modelId: string;
    prompt: string;
    aspectRatio?: string;
  };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const validModel = IMAGE_MODELS.find((m) => m.id === modelId);
  if (!validModel) {
    return NextResponse.json({ error: "Invalid model" }, { status: 400 });
  }

  const feeCents = getWavespeedFeeCents(modelId, "image");
  const balanceCents = await getCreditBalance(user.id);
  if (balanceCents < feeCents) {
    return NextResponse.json(
      {
        error: `Insufficient credits. Need $${(feeCents / 100).toFixed(2)} to generate this image.`,
      },
      { status: 402 }
    );
  }

  try {
    // submitImageTask uses enable_sync_mode — returns completed result directly
    const task = await submitImageTask({ modelId, prompt, aspectRatio });
    try {
      await deductWavespeedCredits({
        userId: user.id,
        modelId,
        mediaType: "image",
        source: "toolbox_image_generate",
        taskId: task.id,
      });
    } catch (creditError) {
      if (creditError instanceof Error && creditError.message === "INSUFFICIENT_CREDITS") {
        return NextResponse.json(
          {
            error: `Insufficient credits. Need $${(feeCents / 100).toFixed(2)} to generate this image.`,
          },
          { status: 402 }
        );
      }
      console.error("Failed to deduct WaveSpeed image credits:", creditError);
    }
    try {
      await trackWavespeedUsage({
        userId: user.id,
        source: "toolbox_image_generate",
        model: modelId,
        prompt,
        metadata: { aspectRatio: aspectRatio ?? "1:1" },
      });
    } catch (usageError) {
      console.error("Failed to track WaveSpeed image usage:", usageError);
    }
    return NextResponse.json({ task });
  } catch (error) {
    console.error("WaveSpeed image error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate image" },
      { status: 500 }
    );
  }
}
