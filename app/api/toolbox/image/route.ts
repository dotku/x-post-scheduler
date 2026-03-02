import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth0";
import { submitImageTask, IMAGE_MODELS } from "@/lib/wavespeed";
import { trackWavespeedUsage } from "@/lib/usage-tracking";
import {
  deductWavespeedCredits,
  getCreditBalance,
  getWavespeedFeeCents,
  getOrCreateTrialUser,
  isDailyTrialCapReached,
} from "@/lib/credits";

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  const ip = forwarded
    ? forwarded.split(",")[0].trim()
    : cfConnectingIp || "unknown";
  return ip;
}

export async function POST(request: NextRequest) {
  // Try to authenticate; if fails, use trial user
  let user: Awaited<ReturnType<typeof getAuthenticatedUser>> | null = null;
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (authenticatedUser) {
      user = authenticatedUser;
    }
  } catch {
    // Not authenticated
  }

  // If not authenticated, use trial user
  if (!user) {
    // Check platform-wide daily trial cap
    if (await isDailyTrialCapReached()) {
      return NextResponse.json(
        {
          error: "Daily trial limit reached. Sign up for a free account to continue!",
          trialMessage: "The platform's daily trial quota has been reached. Sign up to get $5 free credits!",
        },
        { status: 402 },
      );
    }
    const trialUserId = await getOrCreateTrialUser(clientIp, userAgent);
    user = {
      id: trialUserId,
      auth0Sub: "trial",
      email: null,
      name: "Trial User",
      picture: null,
      language: "en",
      weixinCookie: null,
    };
  }

  const body = await request.json();
  const { modelId, prompt, aspectRatio, mode, imageUrl, imageUrls } = body as {
    modelId: string;
    prompt: string;
    aspectRatio?: string;
    mode?: "t2i" | "i2i" | "i2i_text";
    imageUrl?: string;
    imageUrls?: string[];
  };

  const submitMode = mode ?? "t2i";
  const trimmedPrompt = prompt?.trim() ?? "";
  const trimmedImageUrl = imageUrl?.trim() ?? "";
  const validImageUrls = (imageUrls ?? []).filter(Boolean);

  if ((submitMode === "t2i" || submitMode === "i2i_text") && !trimmedPrompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }
  if (
    (submitMode === "i2i" || submitMode === "i2i_text") &&
    !trimmedImageUrl &&
    validImageUrls.length === 0
  ) {
    return NextResponse.json(
      { error: "Input image URL is required for i2i mode" },
      { status: 400 },
    );
  }

  const validModel = IMAGE_MODELS.find((m) => m.id === modelId);
  if (!validModel) {
    return NextResponse.json({ error: "Invalid model" }, { status: 400 });
  }

  const feeCents = getWavespeedFeeCents(modelId, "image");
  const balanceCents = await getCreditBalance(user.id);
  if (balanceCents < feeCents) {
    const isTrialUser = user.id.startsWith("trial-");
    return NextResponse.json(
      {
        error: `Insufficient credits. Need $${(feeCents / 100).toFixed(2)} to generate this image.`,
        ...(isTrialUser && {
          trialMessage:
            "You've used your daily $1 trial credit. Sign up for a free account to unlock more credits!",
        }),
      },
      { status: 402 },
    );
  }

  try {
    // submitImageTask uses enable_sync_mode — returns completed result directly
    const task = await submitImageTask({
      modelId,
      prompt: trimmedPrompt || "Image enhancement",
      mode: submitMode,
      imageUrl: trimmedImageUrl || undefined,
      imageUrls: validImageUrls.length > 0 ? validImageUrls : undefined,
      aspectRatio,
    });
    try {
      await deductWavespeedCredits({
        userId: user.id,
        modelId,
        mediaType: "image",
        source: "toolbox_image_generate",
        taskId: task.id,
      });
    } catch (creditError) {
      if (
        creditError instanceof Error &&
        creditError.message === "INSUFFICIENT_CREDITS"
      ) {
        const isTrialUser = user.id.startsWith("trial-");
        return NextResponse.json(
          {
            error: `Insufficient credits. Need $${(feeCents / 100).toFixed(2)} to generate this image.`,
            ...(isTrialUser && {
              trialMessage:
                "You've used your daily $1 trial credit. Sign up for a free account to unlock more credits!",
            }),
          },
          { status: 402 },
        );
      }
      console.error("Failed to deduct WaveSpeed image credits:", creditError);
    }
    try {
      await trackWavespeedUsage({
        userId: user.id,
        source: "toolbox_image_generate",
        model: modelId,
        prompt: trimmedPrompt,
        metadata: {
          aspectRatio: aspectRatio ?? "1:1",
          mode: submitMode,
          hasImageInput: Boolean(trimmedImageUrl),
        },
      });
    } catch (usageError) {
      console.error("Failed to track WaveSpeed image usage:", usageError);
    }
    const remainingCents = await getCreditBalance(user.id);
    return NextResponse.json({ task, remainingCents });
  } catch (error) {
    console.error("WaveSpeed image error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate image",
      },
      { status: 500 },
    );
  }
}
