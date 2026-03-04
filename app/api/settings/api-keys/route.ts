import { NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { generateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

const MAX_KEYS_PER_USER = 5;

/** GET — list user's active API keys */
export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id, isRevoked: false },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

/** POST — create a new API key */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const name = (body.name as string)?.trim();
  if (!name) {
    return NextResponse.json(
      { error: "Key name is required" },
      { status: 400 },
    );
  }

  // Enforce max keys limit
  const count = await prisma.apiKey.count({
    where: { userId: user.id, isRevoked: false },
  });
  if (count >= MAX_KEYS_PER_USER) {
    return NextResponse.json(
      { error: `Maximum ${MAX_KEYS_PER_USER} API keys per account` },
      { status: 400 },
    );
  }

  const { rawKey, keyHash, keyPrefix } = generateApiKey();

  const key = await prisma.apiKey.create({
    data: {
      name,
      keyPrefix,
      keyHash,
      userId: user.id,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
    },
  });

  // Return raw key exactly once
  return NextResponse.json({
    key: { ...key, rawKey },
  });
}
