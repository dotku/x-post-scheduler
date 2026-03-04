import { prisma } from "./db";
import type { TokenUsage } from "./usage-tracking";

// LLM pricing in cents per 1M tokens (base cost before markup).
// Covers both legacy direct-API keys and AI Gateway model IDs (provider/model format).
const PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  // Legacy direct OpenAI (kept for backwards compatibility)
  "gpt-4o": { inputPer1M: 250, outputPer1M: 1000 }, // $2.50 / $10.00

  // OpenAI (via AI Gateway)
  "openai/gpt-4o":      { inputPer1M: 250, outputPer1M: 1000 },  // $2.50 / $10
  "openai/gpt-4o-mini": { inputPer1M: 15,  outputPer1M: 60 },    // $0.15 / $0.60
  "openai/gpt-5":       { inputPer1M: 125, outputPer1M: 1000 },  // $1.25 / $10

  // Anthropic (via AI Gateway)
  "anthropic/claude-sonnet-4":   { inputPer1M: 300, outputPer1M: 1500 }, // $3 / $15
  "anthropic/claude-3.5-sonnet": { inputPer1M: 300, outputPer1M: 1500 }, // $3 / $15
  "anthropic/claude-3.5-haiku":  { inputPer1M: 80,  outputPer1M: 400 },  // $0.80 / $4

  // Google (via AI Gateway)
  "google/gemini-2.5-flash": { inputPer1M: 30,  outputPer1M: 250 }, // $0.30 / $2.50
  "google/gemini-2.5-pro":   { inputPer1M: 125, outputPer1M: 1000 }, // $1.25 / $10

  // xAI (via AI Gateway)
  "xai/grok-3":      { inputPer1M: 300, outputPer1M: 1500 }, // $3 / $15
  "xai/grok-3-mini": { inputPer1M: 30,  outputPer1M: 50 },   // $0.30 / $0.50
  "xai/grok-3-fast": { inputPer1M: 500, outputPer1M: 2500 }, // $5 / $25

  // Mistral (via AI Gateway)
  "mistral/mistral-small":  { inputPer1M: 10, outputPer1M: 30 },  // $0.10 / $0.30
  "mistral/mistral-medium": { inputPer1M: 40, outputPer1M: 200 }, // $0.40 / $2
};

const DEFAULT_MODEL = "gpt-4o";

function parsePositiveMultiplier(raw: string | undefined, fallback: number) {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

// OpenAI pricing multiplier (configurable via OPENAI_CHARGE_MULTIPLIER)
const MARKUP_MULTIPLIER = parsePositiveMultiplier(
  process.env.OPENAI_CHARGE_MULTIPLIER,
  60,
);

/** Flat fee in cents for agent service calls (no per-token data available). */
export const AGENT_FLAT_FEE_CENTS = 5;

// Wavespeed has different pricing — default is 5x (400% markup)
const WAVESPEED_CHARGE_MULTIPLIER = parsePositiveMultiplier(
  process.env.WAVESPEED_CHARGE_MULTIPLIER,
  5,
);
const WAVESPEED_IMAGE_CHARGE_MULTIPLIER = parsePositiveMultiplier(
  process.env.WAVESPEED_IMAGE_CHARGE_MULTIPLIER,
  WAVESPEED_CHARGE_MULTIPLIER,
);
const WAVESPEED_VIDEO_CHARGE_MULTIPLIER = parsePositiveMultiplier(
  process.env.WAVESPEED_VIDEO_CHARGE_MULTIPLIER,
  WAVESPEED_CHARGE_MULTIPLIER,
);

// Debug logging - remove in production
if (process.env.NODE_ENV !== "production") {
  console.log("[PRICING DEBUG] Multipliers loaded:", {
    WAVESPEED_CHARGE_MULTIPLIER,
    WAVESPEED_IMAGE_CHARGE_MULTIPLIER,
    WAVESPEED_VIDEO_CHARGE_MULTIPLIER,
    env: {
      WAVESPEED_CHARGE_MULTIPLIER: process.env.WAVESPEED_CHARGE_MULTIPLIER,
      WAVESPEED_IMAGE_CHARGE_MULTIPLIER:
        process.env.WAVESPEED_IMAGE_CHARGE_MULTIPLIER,
      WAVESPEED_VIDEO_CHARGE_MULTIPLIER:
        process.env.WAVESPEED_VIDEO_CHARGE_MULTIPLIER,
    },
  });
}

const WAVESPEED_DEFAULT_IMAGE_BASE_COST_CENTS = 5; // $0.05
const WAVESPEED_DEFAULT_VIDEO_BASE_COST_CENTS = 30; // $0.30

const WAVESPEED_MODEL_BASE_COST_CENTS: Record<string, number> = {
  // image t2i
  "bytedance/seedream-v4.5": 4, // $0.04
  "bytedance/seedream-v4": 4, // keep aligned with 4.5
  "wavespeed-ai/qwen-image/text-to-image": 5, // $0.05
  "alibaba/wan-2.6/text-to-image": 8, // larger generation size
  "bytedance/dreamina-v3.1/text-to-image": 6,
  // image i2i
  "wavespeed-ai/uno": 5,
  "wavespeed-ai/real-esrgan": 5,
  "wavespeed-ai/flux-kontext-pro": 8,
  "wavespeed-ai/flux-kontext-pro/multi": 8,
  // video
  "wavespeed-ai/wan-2.2/t2v-480p-ultra-fast": 5, // $0.05
  "wavespeed-ai/wan-2.2/t2v-720p": 30, // $0.30
  "alibaba/wan-2.6/text-to-video": 40,
  "bytedance/seedance-v1.5-pro/text-to-video": 50,
  "kwaivgi/kling-video-o3-std/text-to-video": 60,
  // Seedance 2.0 (via seedanceapi.org)
  "seedance-2.0/text-to-video": 60,
  "seedance-2.0/image-to-video": 60,
};

/**
 * Calculate cost in cents for given token usage after 60x markup.
 * Minimum charge: 1 cent.
 */
export function calculateCostCents(usage: TokenUsage, model?: string): number {
  const rates = PRICING[model ?? ""] ?? PRICING[DEFAULT_MODEL];
  const inputCost = (usage.promptTokens / 1_000_000) * rates.inputPer1M;
  const outputCost = (usage.completionTokens / 1_000_000) * rates.outputPer1M;
  const rawCents = (inputCost + outputCost) * MARKUP_MULTIPLIER;
  return Math.max(1, Math.ceil(rawCents));
}

/**
 * Returns a discount multiplier based on the user's active subscription tier.
 * Gold: 10% off (0.90), Silver: 8% off (0.92), others: no discount (1.0).
 */
async function getSubscriptionDiscount(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true, subscriptionStatus: true },
  });
  if (user?.subscriptionStatus !== "active") return 1.0;
  if (user.subscriptionTier === "gold") return 0.9;
  if (user.subscriptionTier === "silver") return 0.92;
  return 1.0;
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
  mediaType: "image" | "video",
): number {
  const baseCostCents =
    WAVESPEED_MODEL_BASE_COST_CENTS[modelId] ??
    (mediaType === "video"
      ? WAVESPEED_DEFAULT_VIDEO_BASE_COST_CENTS
      : WAVESPEED_DEFAULT_IMAGE_BASE_COST_CENTS);
  const multiplier =
    mediaType === "video"
      ? WAVESPEED_VIDEO_CHARGE_MULTIPLIER
      : WAVESPEED_IMAGE_CHARGE_MULTIPLIER;
  const costCents = Math.max(1, Math.ceil(baseCostCents * multiplier));

  // Debug logging
  if (process.env.NODE_ENV !== "production") {
    console.log("[PRICING] getWavespeedFeeCents:", {
      modelId,
      mediaType,
      baseCostCents,
      multiplier,
      finalCostCents: costCents,
      finalCostDollars: `$${(costCents / 100).toFixed(2)}`,
    });
  }

  return costCents;
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
  const rawCostCents = calculateCostCents(params.usage, params.model);
  const discountMultiplier = await getSubscriptionDiscount(params.userId);
  const costCents = Math.max(1, Math.ceil(rawCostCents * discountMultiplier));
  const savedCents = rawCostCents - costCents;

  // Atomic deduction with negative-balance guard
  const result = await prisma.user.updateMany({
    where: { id: params.userId, creditBalanceCents: { gte: costCents } },
    data: { creditBalanceCents: { decrement: costCents } },
  });

  if (result.count === 0) {
    throw new Error("INSUFFICIENT_CREDITS");
  }

  const updatedUser = await prisma.user.findUniqueOrThrow({
    where: { id: params.userId },
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
        ...(savedCents > 0 && { savedCents }),
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
  const discountMultiplier = await getSubscriptionDiscount(params.userId);
  const costCents = Math.max(
    1,
    Math.ceil(params.feeCents * discountMultiplier),
  );
  const savedCents = params.feeCents - costCents;

  // Atomic deduction with negative-balance guard
  const result = await prisma.user.updateMany({
    where: { id: params.userId, creditBalanceCents: { gte: costCents } },
    data: { creditBalanceCents: { decrement: costCents } },
  });

  if (result.count === 0) {
    throw new Error("INSUFFICIENT_CREDITS");
  }

  const updatedUser = await prisma.user.findUniqueOrThrow({
    where: { id: params.userId },
    select: { creditBalanceCents: true },
  });

  await prisma.creditTransaction.create({
    data: {
      userId: params.userId,
      type: "deduction",
      amountCents: -costCents,
      balanceAfter: updatedUser.creditBalanceCents,
      description: `AI generation (${params.source}) - flat fee`,
      ...(savedCents > 0 && { metadata: JSON.stringify({ savedCents }) }),
    },
  });

  return {
    costCents,
    newBalance: updatedUser.creditBalanceCents,
  };
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
  const rawCostCents = getWavespeedFeeCents(params.modelId, params.mediaType);
  const discountMultiplier = await getSubscriptionDiscount(params.userId);
  const costCents = Math.max(1, Math.ceil(rawCostCents * discountMultiplier));
  const savedCents = rawCostCents - costCents;

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
        ...(savedCents > 0 && { savedCents }),
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
  description?: string;
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
      description:
        params.description ||
        `Credit top-up $${(params.amountCents / 100).toFixed(2)}`,
      stripeSessionId: params.stripeSessionId,
    },
  });

  return updatedUser.creditBalanceCents;
}
/**
 * Get trial user ID based on IP + device fingerprint + date.
 * Format: "trial-{hash(ip+ua+date)}"
 * This prevents bypassing daily quota via localStorage manipulation.
 */
export async function getTrialUserIdFromRequest(
  ipAddress: string,
  userAgent: string,
): Promise<{
  userId: string;
  ipAddress: string;
  userAgent: string;
}> {
  // Create a stable hash of IP + user agent + date
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const crypto = await import("crypto");
  const input = `${ipAddress}|${userAgent}|${today}`;
  const hash = crypto
    .createHash("sha256")
    .update(input)
    .digest("hex")
    .slice(0, 12);
  const trialUserId = `trial-${hash}`;

  return {
    userId: trialUserId,
    ipAddress,
    userAgent,
  };
}

/** Platform-wide daily trial spending cap in cents ($10). */
const PLATFORM_DAILY_TRIAL_CAP_CENTS = 1000;

/**
 * Check if the platform-wide daily trial spending cap has been reached.
 * Sums all deduction transactions from trial users (userId starts with "trial-") today.
 */
export async function isDailyTrialCapReached(): Promise<boolean> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const result = await prisma.creditTransaction.aggregate({
    where: {
      userId: { startsWith: "trial-" },
      type: "deduction",
      createdAt: { gte: today },
    },
    _sum: { amountCents: true },
  });

  // amountCents is negative for deductions, so total spending = abs(sum)
  const totalSpent = Math.abs(result._sum.amountCents ?? 0);
  return totalSpent >= PLATFORM_DAILY_TRIAL_CAP_CENTS;
}

/**
 * Get or create a trial user based on IP + device fingerprint.
 * Ensures each device/IP combo gets $1 per day.
 */
export async function getOrCreateTrialUser(
  ipAddress: string,
  userAgent: string,
): Promise<string> {
  const { userId } = await getTrialUserIdFromRequest(ipAddress, userAgent);
  const DAILY_TRIAL_CREDITS_CENTS = 100; // $1

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Try to find existing daily reset transaction
  const todayReset = await prisma.creditTransaction.findFirst({
    where: {
      userId,
      description: "Daily trial credit reset",
      createdAt: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    select: { id: true },
  });

  // If reset already done today, return the user as is
  if (todayReset) {
    return userId;
  }

  // Create or update user
  const user = await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      creditBalanceCents: DAILY_TRIAL_CREDITS_CENTS,
      auth0Sub: `trial-no-auth-${Date.now()}`,
    },
    select: { creditBalanceCents: true },
  });

  // Check if reset is needed (current balance might be less than 100)
  if (user.creditBalanceCents < DAILY_TRIAL_CREDITS_CENTS) {
    const needed = DAILY_TRIAL_CREDITS_CENTS - user.creditBalanceCents;
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { creditBalanceCents: DAILY_TRIAL_CREDITS_CENTS },
      select: { creditBalanceCents: true },
    });

    // Log the reset transaction
    await prisma.creditTransaction.create({
      data: {
        userId,
        type: "topup",
        amountCents: needed,
        balanceAfter: updatedUser.creditBalanceCents,
        description: "Daily trial credit reset",
        metadata: JSON.stringify({ ipAddress, userAgent }),
      },
    });
  }

  return userId;
}
