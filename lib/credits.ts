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
