import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getCreditBalance, deductCredits, deductFlatFee } from "@/lib/credits";

const NARRATION_MODEL = "google/gemini-2.5-flash";

const ALLOWED_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
type Voice = (typeof ALLOWED_VOICES)[number];

const NARRATION_STYLES = ["professional", "casual", "dramatic", "documentary", "enthusiastic"] as const;
type NarrationStyle = (typeof NARRATION_STYLES)[number];

const STYLE_DESCRIPTIONS: Record<NarrationStyle, string> = {
  professional: "professional and informative, suitable for business or educational content",
  casual: "casual, friendly, and conversational",
  dramatic: "dramatic and cinematic, building suspense and emotion",
  documentary: "documentary-style, objective and authoritative",
  enthusiastic: "enthusiastic and energetic, like a sports or product demo commentary",
};

/** TTS cost: OpenAI tts-1 = $15/1M chars, 5× markup = $75/1M = 7.5¢/1K chars. Min 1¢. */
function getTtsFeeCents(charCount: number): number {
  return Math.max(1, Math.ceil((charCount / 1000) * 7.5));
}

/** Conservative upfront fee estimate for pre-check (Gemini analysis + ~500 char TTS). */
const ESTIMATED_MIN_FEE_CENTS = 8;

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const videoUrl: string = String(body.videoUrl ?? "").trim();
  const language: string = String(body.language ?? "").trim() || "auto";
  const rawStyle = body.style as string;
  const style: NarrationStyle = NARRATION_STYLES.includes(rawStyle as NarrationStyle)
    ? (rawStyle as NarrationStyle)
    : "professional";
  const voice: Voice = ALLOWED_VOICES.includes(body.voice as Voice)
    ? (body.voice as Voice)
    : "nova";
  const mimeType: string = String(body.mimeType ?? "video/mp4").trim();

  if (!videoUrl) {
    return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
  }

  try {
    new URL(videoUrl);
  } catch {
    return NextResponse.json({ error: "Invalid videoUrl" }, { status: 400 });
  }

  // Pre-check: enough credits for at minimum the analysis + short TTS
  const balance = await getCreditBalance(user.id);
  if (balance < ESTIMATED_MIN_FEE_CENTS) {
    return NextResponse.json(
      {
        error: `INSUFFICIENT_CREDITS. Need ~$${(ESTIMATED_MIN_FEE_CENTS / 100).toFixed(2)} but balance is $${(balance / 100).toFixed(2)}.`,
      },
      { status: 402 },
    );
  }

  // Step 1: Gemini 2.5 Flash — analyze video and generate narration script
  const languageInstruction =
    language === "auto"
      ? "Write the narration in the same language as any spoken or written content in the video. Default to English if unclear."
      : `Write the narration in ${language}.`;

  const styleDescription = STYLE_DESCRIPTIONS[style];

  let script = "";
  let analysisUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  try {
    const result = await generateText({
      model: gateway(NARRATION_MODEL),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: new URL(videoUrl),
              mediaType: mimeType,
            },
            {
              type: "text",
              text: `Watch this video carefully and write a narration script for it.

Style: ${styleDescription}.
${languageInstruction}

Requirements:
- Keep the narration under 500 words (for a reasonable audio length)
- Match the pacing and visual content of the video
- Do NOT include stage directions, brackets like [pause], [music], or scene descriptions
- Write only the narration text that will be read aloud as a voice-over
- Make it engaging and natural-sounding`,
            },
          ],
        },
      ],
      maxOutputTokens: 800,
      temperature: 0.7,
    });

    script = result.text?.trim() ?? "";
    if (!script) {
      return NextResponse.json(
        { error: "Failed to generate narration script from video" },
        { status: 500 },
      );
    }
    // Cap at TTS limit
    if (script.length > 4096) {
      script = script.substring(0, 4096);
    }

    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    analysisUsage = {
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: inputTokens + outputTokens,
    };
  } catch (err) {
    console.error("Gemini video narration error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Video analysis failed" },
      { status: 500 },
    );
  }

  // Step 2: Check balance for TTS before converting
  const ttsFeeCents = getTtsFeeCents(script.length);
  const balanceMid = await getCreditBalance(user.id);
  if (balanceMid < ttsFeeCents) {
    // Deduct Gemini cost even though TTS will fail
    try {
      await deductCredits({
        userId: user.id,
        usage: analysisUsage,
        model: NARRATION_MODEL,
        source: "toolbox_narrate_analysis",
      });
    } catch (e) {
      console.error("Failed to deduct narration analysis credits:", e);
    }
    return NextResponse.json(
      {
        error: `INSUFFICIENT_CREDITS for TTS conversion. Need $${(ttsFeeCents / 100).toFixed(2)} but balance is $${(balanceMid / 100).toFixed(2)}.`,
        script, // Return the script even if TTS fails
      },
      { status: 402 },
    );
  }

  // Step 3: OpenAI TTS — convert script to audio
  let audioBase64 = "";
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: script,
      speed: 1.0,
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    audioBase64 = buffer.toString("base64");
  } catch (err) {
    console.error("TTS narration error:", err);
    // Deduct Gemini cost even on TTS failure
    try {
      await deductCredits({
        userId: user.id,
        usage: analysisUsage,
        model: NARRATION_MODEL,
        source: "toolbox_narrate_analysis",
      });
    } catch (e) {
      console.error("Failed to deduct narration analysis credits:", e);
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS conversion failed", script },
      { status: 500 },
    );
  }

  // Step 4: Deduct credits for both Gemini analysis and TTS
  let analysisCostCents = 0;
  try {
    const r = await deductCredits({
      userId: user.id,
      usage: analysisUsage,
      model: NARRATION_MODEL,
      source: "toolbox_narrate_analysis",
    });
    analysisCostCents = r.costCents;
  } catch (e) {
    console.error("Failed to deduct narration analysis credits:", e);
  }

  let ttsCostCents = 0;
  try {
    const r = await deductFlatFee({
      userId: user.id,
      feeCents: ttsFeeCents,
      source: "toolbox_narrate_tts",
    });
    ttsCostCents = r.costCents;
  } catch (e) {
    console.error("Failed to deduct narration TTS credits:", e);
  }

  return NextResponse.json({
    script,
    audioBase64,
    mimeType: "audio/mpeg",
    scriptLength: script.length,
    costs: {
      analysisCents: analysisCostCents,
      ttsCents: ttsCostCents,
      totalCents: analysisCostCents + ttsCostCents,
    },
  });
}
