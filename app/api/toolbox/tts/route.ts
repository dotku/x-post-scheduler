import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getCreditBalance, deductFlatFee } from "@/lib/credits";

const ALLOWED_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
type Voice = (typeof ALLOWED_VOICES)[number];

/** TTS cost: OpenAI tts-1 = $15/1M chars, 5× markup = $75/1M = 7.5¢/1K chars. Min 1¢. */
function getTtsFeeCents(charCount: number): number {
  return Math.max(1, Math.ceil((charCount / 1000) * 7.5));
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
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
    return NextResponse.json(
      {
        error: `INSUFFICIENT_CREDITS. Need $${(feeCents / 100).toFixed(2)} (${text.length} chars) but balance is $${(balanceCents / 100).toFixed(2)}.`,
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
