import { prisma } from "./db";
import type { TokenUsage } from "./usage-tracking";

// OpenAI pricing in cents per 1M tokens
const PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "gpt-4o": { inputPer1M: 250, outputPer1M: 1000 }, // $2.50 / $10.00
};

const DEFAULT_MODEL = "gpt-4o";
const MARKUP_MULTIPLIER = 60;

/** Flat fee in cents for agent service calls (no per-token data available). */
export const AGENT_FLAT_FEE_CENTS = 5;

const WAVESPEED_DEFAULT_IMAGE_FEE_CENTS = 5; // $0.05
const WAVESPEED_DEFAULT_VIDEO_FEE_CENTS = 30; // $0.30

const WAVESPEED_MODEL_FEE_CENTS: Record<string, number> = {
  // image
  "bytedance/seedream-v4.5": 4, // $0.04
  "bytedance/seedream-v4": 4, // keep aligned with 4.5
  "wavespeed-ai/qwen-image/text-to-image": 5, // $0.05
  "alibaba/wan-2.6/text-to-image": 8, // larger generation size
  "bytedance/dreamina-v3.1/text-to-image": 6,
  // video
  "wavespeed-ai/wan-2.2/t2v-480p-ultra-fast": 5, // $0.05
  "wavespeed-ai/wan-2.2/t2v-720p": 30, // $0.30
  "alibaba/wan-2.6/text-to-video": 40,
  "bytedance/seedance-v1.5-pro/text-to-video": 50,
  "kwaivgi/kling-video-o3-std/text-to-video": 60,
};

/**
 * Calculate cost in cents for given token usage after 60x markup.
 * Minimum charge: 1 cent.
 */
export function calculateCostCents(
  usage: TokenUsage,
  model?: string
): number {
  const rates = PRICING[model ?? ""] ?? PRICING[DEFAULT_MODEL];
  const inputCost = (usage.promptTokens / 1_000_000) * rates.inputPer1M;
  const outputCost = (usage.completionTokens / 1_000_000) * rates.outputPer1M;
  const rawCents = (inputCost + outputCost) * MARKUP_MULTIPLIER;
  return Math.max(1, Math.ceil(rawCents));
}

/** Check if user has remaining credits (> 0). */
export async function hasCredits(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalanceCents: true },
  });
  return (user?.creditBalanceCents ?? 0) > 0;
}

/** Get the user's current credit balance in cents. */
export async function getCreditBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalanceCents: true },
  });
  return user?.creditBalanceCents ?? 0;
}

export function getWavespeedFeeCents(
  modelId: string,
  mediaType: "image" | "video"
): number {
  return (
    WAVESPEED_MODEL_FEE_CENTS[modelId] ??
    (mediaType === "video"
      ? WAVESPEED_DEFAULT_VIDEO_FEE_CENTS
      : WAVESPEED_DEFAULT_IMAGE_FEE_CENTS)
  );
}

/**
 * Deduct credits after a successful AI generation.
 * Uses atomic decrement to avoid race conditions.
 */
export async function deductCredits(params: {
  userId: string;
  usage: TokenUsage;
  model?: string;
  source: string;
}): Promise<{ costCents: number; newBalance: number }> {
  const costCents = calculateCostCents(params.usage, params.model);

  const updatedUser = await prisma.user.update({
    where: { id: params.userId },
    data: { creditBalanceCents: { decrement: costCents } },
    select: { creditBalanceCents: true },
  });

  await prisma.creditTransaction.create({
    data: {
      userId: params.userId,
      type: "deduction",
      amountCents: -costCents,
      balanceAfter: updatedUser.creditBalanceCents,
      description: `AI generation (${params.source}) - ${params.usage.totalTokens} tokens`,
      metadata: JSON.stringify({
        model: params.model,
        promptTokens: params.usage.promptTokens,
        completionTokens: params.usage.completionTokens,
      }),
    },
  });

  return { costCents, newBalance: updatedUser.creditBalanceCents };
}

/**
 * Deduct a flat fee (for agent service calls without token data).
 */
export async function deductFlatFee(params: {
  userId: string;
  feeCents: number;
  source: string;
}): Promise<{ costCents: number; newBalance: number }> {
  const updatedUser = await prisma.user.update({
    where: { id: params.userId },
    data: { creditBalanceCents: { decrement: params.feeCents } },
    select: { creditBalanceCents: true },
  });

  await prisma.creditTransaction.create({
    data: {
      userId: params.userId,
      type: "deduction",
      amountCents: -params.feeCents,
      balanceAfter: updatedUser.creditBalanceCents,
      description: `AI generation (${params.source}) - flat fee`,
    },
  });

  return { costCents: params.feeCents, newBalance: updatedUser.creditBalanceCents };
}

/**
 * Deduct fixed fee for WaveSpeed generation requests.
 * Uses conditional decrement to avoid negative balances under race conditions.
 */
export async function deductWavespeedCredits(params: {
  userId: string;
  modelId: string;
  mediaType: "image" | "video";
  source: string;
  taskId?: string;
}): Promise<{ costCents: number; newBalance: number }> {
  const costCents = getWavespeedFeeCents(params.modelId, params.mediaType);

  const updated = await prisma.user.updateMany({
    where: {
      id: params.userId,
      creditBalanceCents: { gte: costCents },
    },
    data: {
      creditBalanceCents: { decrement: costCents },
    },
  });

  if (updated.count === 0) {
    throw new Error("INSUFFICIENT_CREDITS");
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { creditBalanceCents: true },
  });
  const newBalance = user?.creditBalanceCents ?? 0;

  await prisma.creditTransaction.create({
    data: {
      userId: params.userId,
      type: "deduction",
      amountCents: -costCents,
      balanceAfter: newBalance,
      description: `WaveSpeed ${params.mediaType} generation (${params.source})`,
      metadata: JSON.stringify({
        provider: "wavespeed",
        modelId: params.modelId,
        mediaType: params.mediaType,
        taskId: params.taskId ?? null,
      }),
    },
  });

  return { costCents, newBalance };
}

/**
 * Add credits after a successful Stripe top-up.
 * Idempotent: skips if stripeSessionId already credited.
 */
export async function addCredits(params: {
  userId: string;
  amountCents: number;
  stripeSessionId: string;
}): Promise<number> {
  // Prevent double-crediting on webhook retries
  const existing = await prisma.creditTransaction.findFirst({
    where: { stripeSessionId: params.stripeSessionId },
  });
  if (existing) {
    return existing.balanceAfter;
  }

  const updatedUser = await prisma.user.update({
    where: { id: params.userId },
    data: { creditBalanceCents: { increment: params.amountCents } },
    select: { creditBalanceCents: true },
  });

  await prisma.creditTransaction.create({
    data: {
      userId: params.userId,
      type: "topup",
      amountCents: params.amountCents,
      balanceAfter: updatedUser.creditBalanceCents,
      description: `Credit top-up $${(params.amountCents / 100).toFixed(2)}`,
      stripeSessionId: params.stripeSessionId,
    },
  });

  return updatedUser.creditBalanceCents;
}
