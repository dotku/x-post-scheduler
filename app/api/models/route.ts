import { NextResponse } from "next/server";
import { TEXT_MODELS } from "@/lib/ai-models";

/**
 * Public endpoint returning available AI text generation models.
 * Exposes AI provider brand names (OpenAI, Anthropic, etc.) only —
 * infrastructure details are not included in the response.
 */
export async function GET() {
  return NextResponse.json({
    models: TEXT_MODELS.map(({ id, label, provider, description, isDefault }) => ({
      id,
      label,
      provider,
      description,
      isDefault: !!isDefault,
    })),
  });
}
