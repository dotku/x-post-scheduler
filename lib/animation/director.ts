/**
 * AI Director — converts a user prompt into a structured AnimationPlan.
 *
 * Uses Gemini 2.5 Flash (native JSON mode, cheap, already configured in
 * this project). Falls back to gpt-4o if GEMINI_API_KEY is missing.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { validatePlan, type AnimationPlan } from "./types";

const SYSTEM_PROMPT = `You are an AI film director specializing in short-form vertical anime shorts (15-60 seconds, TikTok/Reels style). You convert a user's creative brief into a detailed shot-by-shot production plan.

Your output MUST be a single valid JSON object matching this TypeScript type:

{
  "title": "string (ALL CAPS, 1-4 words, poetic)",
  "subtitle": "string optional",
  "aspectRatio": "9:16",
  "videoModel": "seedance-2.0",
  "narrationVoice": "af_bella" | "af_nova" | "am_michael" | "am_onyx",
  "characters": "string — detailed character anchor, reused verbatim in every scene's imagePrompt",
  "style": "string — visual style anchor, reused verbatim in every scene's imagePrompt",
  "musicPrompt": "string — describes BGM for Replicate musicgen",
  "scenes": [
    {
      "id": "01-descriptive-slug",
      "imagePrompt": "detailed keyframe prompt including [CHARACTERS] and [STYLE] anchors verbatim",
      "motionPrompt": "detailed i2v motion prompt (what happens, camera movement)",
      "duration": 4 | 8,
      "narration": "optional VO line spoken during this scene"
    }
  ],
  "openingTitle": "string optional (shown as 2s title card)",
  "endCard": "string optional (shown as 2s end card)"
}

CRITICAL RULES:

1. **Character consistency** — The \`characters\` field must contain extremely detailed descriptions of every major character (name, age, ethnicity, hair color & length, eye color, skin tone, clothing, accessories). EVERY scene's \`imagePrompt\` must INCLUDE the entire \`characters\` string verbatim — do not paraphrase. If you paraphrase, the output video will have inconsistent faces.

2. **Style consistency** — Same rule. The entire \`style\` string goes verbatim into every \`imagePrompt\`.

3. **Scene count** — 2-5 scenes. For a 30-second short, 3-4 scenes × 8s each. For a 15-second short, 2 scenes.

4. **Duration** — Each scene is 4 or 8 seconds. Default to 8 unless the beat is very quick.

5. **Narration (optional)** — Add \`narration\` to scenes that benefit from voice-over. Keep each line short (8-15 words / ~3-5 seconds of speech). Match voice to narrator identity.

6. **Motion prompts** — Describe what CHANGES in 4-8 seconds. Focus on: character actions, camera movement (dolly, pan, orbit, push-in), ambient motion (hair, wind, leaves, light). Keep motion small/deliberate.

7. **Anime style anchor** — Always use this skeleton: "Makoto Shinkai anime film style, 2D cel-shaded animation, soft cinematic lighting, painterly volumetric god-rays, warm golden-hour glow, vibrant saturated colors, lens flare, dreamy atmosphere, hyper-detailed background art reminiscent of Your Name and Weathering With You, Studio Ghibli influenced, vertical 9:16 cinematic composition."

Output only the JSON object. No markdown fences, no commentary.`;

export type DirectorOptions = {
  prompt: string;
  /** Override model. */
  model?: string;
};

async function callGemini(userPrompt: string, model: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const genAI = new GoogleGenerativeAI(apiKey);
  const llm = genAI.getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
    systemInstruction: SYSTEM_PROMPT,
  });
  const result = await llm.generateContent(userPrompt);
  return result.response.text();
}

async function callOpenAI(userPrompt: string, model: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });
  return response.choices[0]?.message?.content ?? "";
}

export async function planAnimation(opts: DirectorOptions): Promise<AnimationPlan> {
  const useGemini = Boolean(process.env.GEMINI_API_KEY);
  const model = opts.model ?? (useGemini ? "gemini-2.5-flash" : "gpt-4o");

  const content = useGemini
    ? await callGemini(opts.prompt, model)
    : await callOpenAI(opts.prompt, model);

  if (!content) throw new Error("Director returned empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(
      `Director returned invalid JSON: ${e instanceof Error ? e.message : e}\n\nRaw:\n${content.slice(0, 500)}`,
    );
  }

  return validatePlan(parsed);
}
