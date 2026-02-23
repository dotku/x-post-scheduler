import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { submitBgmTask, getVideoTask } from "@/lib/wavespeed";

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const { videoUrl, prompt, duration } = body as {
    videoUrl: string;
    prompt: string;
    duration?: number;
  };

  if (!videoUrl?.trim()) {
    return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
  }
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    const task = await submitBgmTask({ videoUrl, prompt, duration });
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "BGM generation failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const taskIdOrUrl = request.nextUrl.searchParams.get("taskId") ?? "";
  if (!taskIdOrUrl) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  try {
    const task = await getVideoTask(taskIdOrUrl);
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Poll failed" },
      { status: 500 }
    );
  }
}
