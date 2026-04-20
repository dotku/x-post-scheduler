/**
 * Curated list of text generation models available via AI Gateway.
 * Displays AI brand names (OpenAI, Anthropic, etc.) — infrastructure provider is not exposed.
 */
export interface AiTextModel {
  id: string;          // Gateway model ID format: "provider/model-name"
  label: string;       // Display name shown to users
  provider: string;    // AI brand: OpenAI, Anthropic, Google, xAI, Mistral
  description?: string;
  isDefault?: boolean;
}

export const TEXT_MODELS: AiTextModel[] = [
  // OpenAI
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
    description: "Most capable, best quality",
    isDefault: true,
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "OpenAI",
    description: "Fast and affordable",
  },
  {
    id: "openai/gpt-5",
    label: "GPT-5",
    provider: "OpenAI",
    description: "Latest flagship model",
  },
  // Anthropic
  {
    id: "anthropic/claude-sonnet-4",
    label: "Claude Sonnet 4",
    provider: "Anthropic",
    description: "Excellent writing quality",
  },
  {
    id: "anthropic/claude-3.5-haiku",
    label: "Claude 3.5 Haiku",
    provider: "Anthropic",
    description: "Fast, cost-efficient",
  },
  // Google
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "Google",
    description: "Fast, low cost",
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "Google",
    description: "High performance reasoning",
  },
  // xAI
  {
    id: "xai/grok-3",
    label: "Grok 3",
    provider: "xAI",
    description: "Real-time aware",
  },
  {
    id: "xai/grok-3-mini",
    label: "Grok 3 Mini",
    provider: "xAI",
    description: "Lightweight and fast",
  },
  // Mistral
  {
    id: "mistral/mistral-small",
    label: "Mistral Small",
    provider: "Mistral",
    description: "Efficient European model",
  },
  {
    id: "mistral/mistral-medium",
    label: "Mistral Medium",
    provider: "Mistral",
    description: "Balanced performance",
  },
  // Free Models (via OpenRouter) — billed at zero cost to the user
  {
    id: "openrouter/openai/gpt-oss-120b:free",
    label: "GPT-OSS 120B (Free)",
    provider: "OpenAI",
    description: "Open-source flagship · 120B params",
  },
  {
    id: "openrouter/openai/gpt-oss-20b:free",
    label: "GPT-OSS 20B (Free)",
    provider: "OpenAI",
    description: "Smaller open-source · faster",
  },
  {
    id: "openrouter/meta-llama/llama-3.3-70b-instruct:free",
    label: "Llama 3.3 70B (Free)",
    provider: "Meta",
    description: "Strong general-purpose · 70B",
  },
  {
    id: "openrouter/google/gemma-3-27b-it:free",
    label: "Gemma 3 27B (Free)",
    provider: "Google",
    description: "131K context · efficient",
  },
  {
    id: "openrouter/google/gemma-3-12b-it:free",
    label: "Gemma 3 12B (Free)",
    provider: "Google",
    description: "Lightweight · multimodal",
  },
  {
    id: "openrouter/qwen/qwen3-coder:free",
    label: "Qwen3 Coder (Free)",
    provider: "Qwen",
    description: "Coding-optimized · Alibaba",
  },
  {
    id: "openrouter/qwen/qwen3-next-80b-a3b-instruct:free",
    label: "Qwen3 Next 80B (Free)",
    provider: "Qwen",
    description: "80B MoE · long context",
  },
  {
    id: "openrouter/nvidia/nemotron-3-super-120b-a12b:free",
    label: "Nemotron 3 Super (Free)",
    provider: "NVIDIA",
    description: "120B MoE · NVIDIA flagship",
  },
  {
    id: "openrouter/z-ai/glm-4.5-air:free",
    label: "GLM 4.5 Air (Free)",
    provider: "Z.AI",
    description: "Efficient reasoning · Chinese-optimized",
  },
  {
    id: "openrouter/nousresearch/hermes-3-llama-3.1-405b:free",
    label: "Hermes 3 405B (Free)",
    provider: "Nous Research",
    description: "Largest free model · 405B",
  },
];

export const DEFAULT_TEXT_MODEL = TEXT_MODELS.find((m) => m.isDefault)!;

/** Validate a model ID against the registry; returns the default if unknown. */
export function resolveTextModel(modelId?: string): AiTextModel {
  if (!modelId) return DEFAULT_TEXT_MODEL;
  return TEXT_MODELS.find((m) => m.id === modelId) ?? DEFAULT_TEXT_MODEL;
}
