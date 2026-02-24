import { NextRequest, NextResponse } from "next/server";
import { getOrCreateTrialUser, deductCredits, getCreditBalance } from "@/lib/credits";
import { trackTokenUsage } from "@/lib/usage-tracking";
import { generateLandingTweetViaGateway } from "@/lib/ai-gateway";

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const ua = request.headers.get("user-agent") ?? "unknown";

  const trialUserId = await getOrCreateTrialUser(ip, ua);

  const balance = await getCreditBalance(trialUserId);
  if (balance <= 0) {
    return NextResponse.json(
      {
        error: "trial_exhausted",
        message:
          "Your free trial ($1/day) has been used up. Sign up to get $5 of free credits.",
      },
      { status: 402 },
    );
  }

  const body = await request.json();
  const { topic, tone, goal, language, model: modelId } = body;

  if (!topic?.trim() || !tone?.trim() || !goal?.trim()) {
    return NextResponse.json(
      { error: "topic, tone, and goal are required" },
      { status: 400 },
    );
  }

  try {
    const result = await generateLandingTweetViaGateway({
      topic,
      tone,
      goal,
      language,
      modelId,
    });

    if (!result.success || !result.content) {
      return NextResponse.json({ error: result.error ?? "Generation failed" }, { status: 500 });
    }

    // Track usage and deduct credits (best-effort)
    if (result.usage) {
      try {
        await trackTokenUsage({
          userId: trialUserId,
          source: "landing_generate",
          usage: result.usage,
          model: result.modelId,
        });
        await deductCredits({
          userId: trialUserId,
          usage: result.usage,
          model: result.modelId,
          source: "landing_generate",
        });
      } catch (err) {
        console.error("Failed to deduct trial credits:", err);
      }
    }

    const newBalance = await getCreditBalance(trialUserId);

    return NextResponse.json({
      content: result.content,
      remainingCents: newBalance,
    });
  } catch (err) {
    console.error("Landing generate error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
