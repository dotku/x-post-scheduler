import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { submitBgmTask, getVideoTask } from "@/lib/wavespeed";
import { getCreditBalance, deductFlatFee } from "@/lib/credits";

/** MMAudio V2 cost: $0.001/second, 5× markup = $0.005/second = 0.5¢/sec. Min 1¢. */
function getBgmFeeCents(durationSecs: number): number {
  return Math.max(1, Math.ceil(durationSecs * 0.5));
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
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

  const durationSecs = Math.min(30, Math.max(1, Number(duration ?? 8)));
  const feeCents = getBgmFeeCents(durationSecs);

  const balance = await getCreditBalance(user.id);
  if (balance < feeCents) {
    return NextResponse.json(
      {
        error: `INSUFFICIENT_CREDITS. Need $${(feeCents / 100).toFixed(2)} for ${durationSecs}s BGM but balance is $${(balance / 100).toFixed(2)}.`,
      },
      { status: 402 },
    );
  }

  try {
    const task = await submitBgmTask({ videoUrl, prompt, duration: durationSecs });

    // Deduct credits after successful task submission
    try {
      await deductFlatFee({
        userId: user.id,
        feeCents,
        source: "toolbox_bgm",
      });
    } catch (creditErr) {
      console.error("Failed to deduct BGM credits:", creditErr);
    }

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
