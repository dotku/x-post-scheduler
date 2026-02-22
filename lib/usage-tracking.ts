import { prisma } from "./db";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Coarse token estimate when providers do not return token counts.
 * English averages roughly ~4 chars/token, CJK can be denser; this keeps
 * accounting stable while avoiding undercounting too aggressively.
 */
export function estimatePromptTokens(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 1;
  return Math.max(1, Math.ceil(normalized.length / 3.5));
}

export async function trackTokenUsage(params: {
  userId: string;
  source: string;
  usage: TokenUsage;
  model?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.usageEvent.create({
    data: {
      userId: params.userId,
      source: params.source,
      provider: params.provider ?? "openai",
      model: params.model ?? null,
      promptTokens: params.usage.promptTokens,
      completionTokens: params.usage.completionTokens,
      totalTokens: params.usage.totalTokens,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });
}

export async function trackWavespeedUsage(params: {
  userId: string;
  source: string;
  model: string;
  prompt: string;
  metadata?: Record<string, unknown>;
}) {
  const promptTokens = estimatePromptTokens(params.prompt);
  await trackTokenUsage({
    userId: params.userId,
    source: params.source,
    provider: "wavespeed",
    model: params.model,
    usage: {
      promptTokens,
      completionTokens: 0,
      totalTokens: promptTokens,
    },
    metadata: {
      estimated: true,
      estimationMethod: "chars_div_3_5",
      ...params.metadata,
    },
  });
}
