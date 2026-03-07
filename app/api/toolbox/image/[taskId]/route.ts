import { NextRequest, NextResponse } from "next/server";
import { getVideoTask } from "@/lib/wavespeed";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;

  try {
    const pollUrl = request.nextUrl.searchParams.get("pollUrl") ?? taskId;
    const task = await getVideoTask(pollUrl);
    return NextResponse.json({ task });
  } catch (error) {
    console.error("Image poll error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get task" },
      { status: 500 },
    );
  }
}
