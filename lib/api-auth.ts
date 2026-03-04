/**
 * API Key authentication, generation, and rate limiting for the v1 external API.
 */
import crypto from "crypto";
import { NextResponse } from "next/server";

const API_KEY_PREFIX = "xp_";
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30;

// ── Key generation ──────────────────────────────────────────────────────────

export function generateApiKey(): {
  rawKey: string;
  keyHash: string;
  keyPrefix: string;
} {
  const randomBytes = crypto.randomBytes(32).toString("hex");
  const rawKey = `${API_KEY_PREFIX}${randomBytes}`;
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 11); // "xp_" + 8 chars
  return { rawKey, keyHash, keyPrefix };
}

export function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

// ── Key validation / user lookup ────────────────────────────────────────────

export async function authenticateApiKey(
  authHeader: string | null,
): Promise<{ userId: string; apiKeyId: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const rawKey = authHeader.slice(7).trim();
  if (!rawKey.startsWith(API_KEY_PREFIX)) return null;

  const keyHash = hashKey(rawKey);
  const { prisma } = await import("./db");

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, userId: true, isRevoked: true, expiresAt: true },
  });

  if (!apiKey || apiKey.isRevoked) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // Update lastUsedAt (fire-and-forget)
  void prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return { userId: apiKey.userId, apiKeyId: apiKey.id };
}

// ── Rate limiting (in-memory sliding window) ────────────────────────────────

const rateLimitMap = new Map<
  string,
  { count: number; resetAt: number }
>();

export function checkRateLimit(apiKeyId: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = rateLimitMap.get(apiKeyId);

  if (!entry || now >= entry.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitMap.set(apiKeyId, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt };
  }

  entry.count++;
  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count);
  return {
    allowed: entry.count <= RATE_LIMIT_MAX_REQUESTS,
    remaining,
    resetAt: entry.resetAt,
  };
}

// ── Response helpers ────────────────────────────────────────────────────────

export function apiError(message: string, status: number, code?: string) {
  return NextResponse.json(
    { error: { message, code: code ?? "ERROR" } },
    { status },
  );
}

export function rateLimitResponse(resetAt: number) {
  return NextResponse.json(
    { error: { message: "Rate limit exceeded", code: "RATE_LIMITED" } },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
        "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

/**
 * Standard auth + rate-limit guard for v1 API routes.
 * Returns the authenticated context or a NextResponse error.
 */
export async function requireApiAuth(
  authHeader: string | null,
): Promise<
  | { userId: string; apiKeyId: string }
  | NextResponse
> {
  const auth = await authenticateApiKey(authHeader);
  if (!auth) return apiError("Invalid or missing API key", 401, "UNAUTHORIZED");

  const rl = checkRateLimit(auth.apiKeyId);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  return auth;
}
