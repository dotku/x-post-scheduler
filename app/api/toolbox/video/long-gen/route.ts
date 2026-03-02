import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { prisma } from "@/lib/db";
import { getCreditBalance, getWavespeedFeeCents } from "@/lib/credits";

/**
 * POST: Submit a long video generation job
 * Returns quickly with jobId; processing happens in background
 */
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  if (!user?.id) {
    return NextResponse.json(
      { error: "Invalid user session" },
      { status: 401 },
    );
  }

  // Long video is a members-only feature — require active subscription
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { subscriptionTier: true, subscriptionStatus: true },
  });

  if (dbUser?.subscriptionStatus !== "active" || !dbUser?.subscriptionTier) {
    return NextResponse.json(
      { error: "Long video generation is a members-only feature. Please subscribe to access this feature." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const {
    modelId,
    modelLabel,
    videoMode,
    prompt,
    segmentCount,
    duration = 5,
    aspectRatio = "16:9",
    generateAudio = false,
    i2vImageUrl,
  } = body as {
    modelId: string;
    modelLabel: string;
    videoMode: "t2v" | "i2v";
    prompt: string;
    segmentCount: number;
    duration?: number;
    aspectRatio?: string;
    generateAudio?: boolean;
    i2vImageUrl?: string;
  };

  // Validate required fields
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  if (!modelId) {
    return NextResponse.json(
      { error: "Model ID is required" },
      { status: 400 },
    );
  }

  if (segmentCount < 2 || segmentCount > 8) {
    return NextResponse.json(
      { error: "Segment count must be between 2 and 8" },
      { status: 400 },
    );
  }

  // Validate image for i2v models
  if (videoMode === "i2v" && !i2vImageUrl) {
    return NextResponse.json(
      { error: "Image is required for image-to-video models. Please upload an image first." },
      { status: 400 },
    );
  }

  // Check credit balance for all segments
  const costPerSegment = getWavespeedFeeCents(modelId, "video");
  const totalCost = costPerSegment * segmentCount;
  const balance = await getCreditBalance(user.id);

  if (balance < totalCost) {
    return NextResponse.json(
      {
        error: `Insufficient credits. Need $${(totalCost / 100).toFixed(2)} but have $${(balance / 100).toFixed(2)}`,
      },
      { status: 402 },
    );
  }

  try {
    // Prepare segment data
    const segmentData = Array.from({ length: segmentCount }).map((_, i) => ({
      index: i + 1,
      status: "queued",
      outputUrl: null,
      error: null,
      taskId: null,
    }));

    // Create job record
    const job = await prisma.videoJob.create({
      data: {
        userId: user.id,
        modelId: modelId || "",
        modelLabel: modelLabel || modelId || "",
        videoMode: videoMode || "t2v",
        prompt: prompt.trim(),
        segmentCount,
        duration,
        aspectRatio: aspectRatio || "16:9",
        generateAudio,
        i2vImageUrl: i2vImageUrl || null,
        status: "pending",
        segments: JSON.stringify(segmentData),
      },
    });

    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    console.error("Failed to create video job:", error);
    const errorMessage =
      error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Error details:", { errorMessage, body });
    return NextResponse.json(
      { error: `Failed to create job: ${errorMessage}` },
      { status: 500 },
    );
  }
}
