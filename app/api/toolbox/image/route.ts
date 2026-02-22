import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { submitImageTask, IMAGE_MODELS } from "@/lib/wavespeed";

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
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

  try {
    // submitImageTask uses enable_sync_mode — returns completed result directly
    const task = await submitImageTask({ modelId, prompt, aspectRatio });
    return NextResponse.json({ task });
  } catch (error) {
    console.error("WaveSpeed image error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate image" },
      { status: 500 }
    );
  }
}
