/**
 * Direct Gemini image generation via REST API.
 * Uses gemini-2.5-flash-image-preview which supports multimodal output.
 * Bypasses OpenRouter (which requires a paid account).
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const IMAGE_MODEL = "gemini-2.5-flash-image";

export type GeminiImageResult = {
  buffer: Buffer;
  mimeType: string;
};

export type GeminiImageInput = {
  prompt: string;
  /** Optional reference image (preserves character/subject identity). */
  referenceImage?: { buffer: Buffer; mimeType: string };
};

export async function generateGeminiImage(input: string | GeminiImageInput): Promise<GeminiImageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const normalized = typeof input === "string" ? { prompt: input } : input;

  const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];
  if (normalized.referenceImage) {
    parts.push({
      inlineData: {
        data: normalized.referenceImage.buffer.toString("base64"),
        mimeType: normalized.referenceImage.mimeType,
      },
    });
  }
  parts.push({ text: normalized.prompt });

  const url = `${GEMINI_BASE}/models/${IMAGE_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini image generation failed (${res.status}): ${text.slice(0, 400)}`);
  }

  type Part = { inlineData?: { data: string; mimeType: string }; text?: string };
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: Part[] } }[];
  };

  const responseParts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = responseParts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData) {
    throw new Error("Gemini response had no inline image data");
  }

  return {
    buffer: Buffer.from(imagePart.inlineData.data, "base64"),
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}
