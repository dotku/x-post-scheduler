import { prisma } from "./db";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
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
