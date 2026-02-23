const IMAGE_MODEL_PREFIX = "[[image_model:";
const IMAGE_MODEL_SUFFIX = "]]";

function normalizePrompt(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function encodeRecurringAiPrompt(params: {
  prompt?: string | null;
  imageModelId?: string | null;
}): string | null {
  const prompt = normalizePrompt(params.prompt);
  const imageModelId = normalizePrompt(params.imageModelId);

  if (!imageModelId) return prompt;

  const marker = `${IMAGE_MODEL_PREFIX}${imageModelId}${IMAGE_MODEL_SUFFIX}`;
  if (!prompt) return marker;
  return `${marker}\n${prompt}`;
}

export function decodeRecurringAiPrompt(raw: string | null | undefined): {
  prompt: string | null;
  imageModelId: string | null;
} {
  const value = (raw ?? "").trim();
  if (!value.startsWith(IMAGE_MODEL_PREFIX)) {
    return { prompt: normalizePrompt(value), imageModelId: null };
  }

  const suffixIndex = value.indexOf(IMAGE_MODEL_SUFFIX);
  if (suffixIndex === -1) {
    return { prompt: normalizePrompt(value), imageModelId: null };
  }

  const imageModelId = normalizePrompt(
    value.slice(IMAGE_MODEL_PREFIX.length, suffixIndex)
  );
  const prompt = normalizePrompt(value.slice(suffixIndex + IMAGE_MODEL_SUFFIX.length));
  return { prompt, imageModelId };
}
