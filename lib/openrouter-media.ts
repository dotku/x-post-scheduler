/**
 * OpenRouter media (image) generation provider.
 * Uses the Vercel AI SDK's generateImage() with the OpenRouter provider.
 */
import { generateImage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { VideoTask } from "./wavespeed";

function getOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  return createOpenRouter({ apiKey });
}

/** OpenRouter free image models */
export const OPENROUTER_IMAGE_MODELS: {
  id: string;
  label: string;
  description: string;
  tier: "fast" | "standard" | "premium";
  openrouterId: string;
}[] = [
  {
    id: "openrouter/black-forest-labs/flux-2-pro",
    label: "FLUX.2 Pro (Free)",
    description: "Black Forest Labs · free",
    tier: "fast",
    openrouterId: "black-forest-labs/flux-2-pro",
  },
  {
    id: "openrouter/black-forest-labs/flux-2-max",
    label: "FLUX.2 Max (Free)",
    description: "Black Forest Labs · highest quality · free",
    tier: "standard",
    openrouterId: "black-forest-labs/flux-2-max",
  },
  {
    id: "openrouter/black-forest-labs/flux-2-flex",
    label: "FLUX.2 Flex (Free)",
    description: "Black Forest Labs · flexible · free",
    tier: "fast",
    openrouterId: "black-forest-labs/flux-2-flex",
  },
  {
    id: "openrouter/black-forest-labs/flux-2-klein-4b",
    label: "FLUX.2 Klein 4B (Free)",
    description: "Black Forest Labs · lightweight · free",
    tier: "fast",
    openrouterId: "black-forest-labs/flux-2-klein-4b",
  },
  {
    id: "openrouter/bytedance-seed/seedream-v4.5",
    label: "Seedream 4.5 (Free)",
    description: "ByteDance · 中英双语 · free",
    tier: "standard",
    openrouterId: "bytedance-seed/seedream-v4.5",
  },
  {
    id: "openrouter/google/gemini-2.5-flash-image",
    label: "Gemini 2.5 Flash Image",
    description: "Google · fast · low cost",
    tier: "fast",
    openrouterId: "google/gemini-2.5-flash-image",
  },
  {
    id: "openrouter/google/gemini-3.1-flash-image-preview",
    label: "Gemini 3.1 Flash Image",
    description: "Google · latest · fast",
    tier: "standard",
    openrouterId: "google/gemini-3.1-flash-image-preview",
  },
];

/**
 * Submit an image generation task via OpenRouter.
 * Returns a VideoTask-compatible response for integration with the existing pipeline.
 */
export async function submitOpenRouterImageTask(params: {
  modelId: string;
  prompt: string;
  aspectRatio?: string;
}): Promise<VideoTask> {
  const model = OPENROUTER_IMAGE_MODELS.find((m) => m.id === params.modelId);
  if (!model) throw new Error(`Unknown OpenRouter image model: ${params.modelId}`);

  const openrouter = getOpenRouter();

  const result = await generateImage({
    model: openrouter.imageModel(model.openrouterId),
    prompt: params.prompt,
    ...(params.aspectRatio ? { aspectRatio: params.aspectRatio as `${number}:${number}` } : {}),
  });

  // Convert base64 data URL to a usable URL
  const imageBase64 = result.image.base64;
  const mimeType = (result.image as { mimeType?: string }).mimeType || "image/png";
  const dataUrl = `data:${mimeType};base64,${imageBase64}`;

  // Return VideoTask-compatible response
  return {
    id: `or-img-${Date.now()}`,
    status: "completed",
    outputs: [dataUrl],
  } as VideoTask;
}

export function isOpenRouterImageModel(modelId: string): boolean {
  return modelId.startsWith("openrouter/");
}
