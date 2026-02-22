import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { submitVideoTask, VIDEO_MODELS } from "@/lib/wavespeed";

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
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

  try {
    const task = await submitVideoTask({ modelId, prompt, duration, aspectRatio });
    return NextResponse.json({ task });
  } catch (error) {
    console.error("WaveSpeed submit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit task" },
      { status: 500 }
    );
  }
}
