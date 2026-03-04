import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, apiError } from "@/lib/api-auth";
import { pollVideo } from "@/lib/video-provider";
import type { VideoProvider } from "@/lib/video-provider";

/** GET /api/v1/video/:taskId — poll video generation status */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const auth = await requireApiAuth(request.headers.get("authorization"));
  if (auth instanceof NextResponse) return auth;

  const { taskId } = await params;
  const provider = (request.nextUrl.searchParams.get("provider") ?? "wavespeed") as VideoProvider;
  const pollUrl = request.nextUrl.searchParams.get("pollUrl") ?? taskId;

  // For Seedance, use taskId directly; for Wavespeed, use pollUrl
  const taskIdOrUrl = provider === "seedance" ? taskId : pollUrl;

  try {
    const task = await pollVideo(taskIdOrUrl, provider);
    return NextResponse.json({
      task_id: task.id,
      status: task.status,
      outputs: task.outputs ?? [],
      error: task.error,
      created_at: task.createdAt,
      provider,
    });
  } catch (error) {
    console.error("API v1 video poll error:", error);
    return apiError(
      error instanceof Error ? error.message : "Failed to get task",
      500,
      "POLL_FAILED",
    );
  }
}
