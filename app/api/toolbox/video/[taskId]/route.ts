import { NextRequest, NextResponse } from "next/server";
import { pollVideo, type VideoProvider } from "@/lib/video-provider";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;

  try {
    const provider = (request.nextUrl.searchParams.get("provider") ?? "wavespeed") as VideoProvider;
    const pollUrl = request.nextUrl.searchParams.get("pollUrl") ?? taskId;
    // Seedance uses task ID directly; Wavespeed uses pollUrl
    const task = await pollVideo(provider === "seedance" ? taskId : pollUrl, provider);
    return NextResponse.json({ task });
  } catch (error) {
    console.error("Video poll error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get task" },
      { status: 500 },
    );
  }
}
