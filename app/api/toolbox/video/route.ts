import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { submitVideoTask, VIDEO_MODELS } from "@/lib/wavespeed";
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
  const { modelId, prompt, duration, aspectRatio } = body as {
    modelId: string;
    prompt: string;
    duration?: number;
    aspectRatio?: string;
  };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const validModel = VIDEO_MODELS.find((m) => m.id === modelId);
  if (!validModel) {
    return NextResponse.json({ error: "Invalid model" }, { status: 400 });
  }

  const feeCents = getWavespeedFeeCents(modelId, "video");
  const balanceCents = await getCreditBalance(user.id);
  if (balanceCents < feeCents) {
    return NextResponse.json(
      {
        error: `Insufficient credits. Need $${(feeCents / 100).toFixed(2)} to generate this video.`,
      },
      { status: 402 }
    );
  }

  try {
    const task = await submitVideoTask({ modelId, prompt, duration, aspectRatio });
    try {
      await deductWavespeedCredits({
        userId: user.id,
        modelId,
        mediaType: "video",
        source: "toolbox_video_generate",
        taskId: task.id,
      });
    } catch (creditError) {
      if (creditError instanceof Error && creditError.message === "INSUFFICIENT_CREDITS") {
        return NextResponse.json(
          {
            error: `Insufficient credits. Need $${(feeCents / 100).toFixed(2)} to generate this video.`,
          },
          { status: 402 }
        );
      }
      console.error("Failed to deduct WaveSpeed video credits:", creditError);
    }
    try {
      await trackWavespeedUsage({
        userId: user.id,
        source: "toolbox_video_generate",
        model: modelId,
        prompt,
        metadata: {
          duration: duration ?? 5,
          aspectRatio: aspectRatio ?? "16:9",
        },
      });
    } catch (usageError) {
      console.error("Failed to track WaveSpeed video usage:", usageError);
    }
    return NextResponse.json({ task });
  } catch (error) {
    console.error("WaveSpeed submit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit task" },
      { status: 500 }
    );
  }
}
