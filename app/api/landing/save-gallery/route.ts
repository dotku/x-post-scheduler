import { NextRequest, NextResponse } from "next/server";
import { getOrCreateTrialUser } from "@/lib/credits";
import { saveToGallery } from "@/lib/gallery";

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const ua = request.headers.get("user-agent") ?? "unknown";

  const body = await request.json();
  const { type, modelId, modelLabel, prompt, sourceUrl, aspectRatio } =
    body as {
      type: "image" | "video";
      modelId: string;
      modelLabel: string;
      prompt: string;
      sourceUrl: string;
      aspectRatio?: string;
    };

  if (!type || !modelId || !modelLabel || !prompt || !sourceUrl) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const trialUserId = await getOrCreateTrialUser(ip, ua);

  try {
    const item = await saveToGallery({
      userId: trialUserId,
      type,
      modelId,
      modelLabel,
      prompt,
      sourceUrl,
      aspectRatio,
      isPublic: true,
      generationMeta: { source: "landing_trial" },
    });
    return NextResponse.json({ success: true, itemId: item.id });
  } catch (error) {
    console.error("Landing gallery save error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save" },
      { status: 500 },
    );
  }
}
