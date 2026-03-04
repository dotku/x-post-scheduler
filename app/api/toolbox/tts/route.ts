import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthenticatedUser } from "@/lib/auth0";
import {
  getCreditBalance,
  deductFlatFee,
  getOrCreateTrialUser,
  isDailyTrialCapReached,
} from "@/lib/credits";

const ALLOWED_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
type Voice = (typeof ALLOWED_VOICES)[number];

/** TTS cost: OpenAI tts-1 = $15/1M chars, 5× markup = $75/1M = 7.5¢/1K chars. Min 1¢. */
function getTtsFeeCents(charCount: number): number {
  return Math.max(1, Math.ceil((charCount / 1000) * 7.5));
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  const ip = forwarded
    ? forwarded.split(",")[0].trim()
    : cfConnectingIp || "unknown";
  return ip;
}

export async function POST(request: NextRequest) {
  let user: Awaited<ReturnType<typeof getAuthenticatedUser>> | null = null;
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (authenticatedUser) {
      user = authenticatedUser;
    }
  } catch {
    // Not authenticated
  }

  if (!user) {
    if (await isDailyTrialCapReached()) {
      return NextResponse.json(
        {
          error:
            "Daily trial limit reached. Sign up for a free account to continue!",
          trialMessage:
            "The platform's daily trial quota has been reached. Sign up to get $5 free credits!",
        },
        { status: 402 },
      );
    }
    const trialUserId = await getOrCreateTrialUser(clientIp, userAgent);
    user = {
      id: trialUserId,
      auth0Sub: "trial",
      email: null,
      name: "Trial User",
      picture: null,
      language: "en",
      weixinCookie: null,
    };
  }

  const body = await request.json();
  const text: string = String(body.text ?? "").trim();
  const voice: Voice = ALLOWED_VOICES.includes(body.voice) ? body.voice : "nova";
  const speed: number = Math.min(4.0, Math.max(0.25, Number(body.speed ?? 1.0)));

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (text.length > 4096) {
    return NextResponse.json({ error: "text must be ≤ 4096 characters" }, { status: 400 });
  }

  const feeCents = getTtsFeeCents(text.length);
  const balanceCents = await getCreditBalance(user.id);
  if (balanceCents < feeCents) {
    const isTrialUser = user.id.startsWith("trial-");
    return NextResponse.json(
      {
        error: `INSUFFICIENT_CREDITS. Need $${(feeCents / 100).toFixed(2)} (${text.length} chars) but balance is $${(balanceCents / 100).toFixed(2)}.`,
        ...(isTrialUser && {
          trialMessage:
            "You've used your daily $1 trial credit. Sign up for a free account to unlock more credits!",
        }),
      },
      { status: 402 },
    );
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: text,
      speed,
    });

    // Deduct credits after successful generation
    try {
      await deductFlatFee({
        userId: user.id,
        feeCents,
        source: "toolbox_tts",
      });
    } catch (creditErr) {
      console.error("Failed to deduct TTS credits:", creditErr);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'inline; filename="voiceover.mp3"',
        "Cache-Control": "private, max-age=300",
        "X-Cost-Cents": String(feeCents),
      },
    });
  } catch (err) {
    console.error("TTS error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS generation failed" },
      { status: 500 }
    );
  }
}
