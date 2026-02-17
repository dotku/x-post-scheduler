import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { encrypt } from "@/lib/encryption";
import { verifyCredentials } from "@/lib/x-client";

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      xApiKey: true,
      xApiSecret: true,
      xAccessToken: true,
      xAccessTokenSecret: true,
    },
  });

  return NextResponse.json({
    hasCredentials: !!(
      dbUser?.xApiKey &&
      dbUser?.xApiSecret &&
      dbUser?.xAccessToken &&
      dbUser?.xAccessTokenSecret
    ),
  });
}

export async function PUT(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const { xApiKey, xApiSecret, xAccessToken, xAccessTokenSecret } = body;

  if (!xApiKey || !xApiSecret || !xAccessToken || !xAccessTokenSecret) {
    return NextResponse.json(
      { error: "All four credential fields are required" },
      { status: 400 }
    );
  }

  // Verify credentials with X API
  const verification = await verifyCredentials({
    apiKey: xApiKey,
    apiSecret: xApiSecret,
    accessToken: xAccessToken,
    accessTokenSecret: xAccessTokenSecret,
  });

  if (!verification.valid) {
    return NextResponse.json(
      { error: `Invalid credentials: ${verification.error}` },
      { status: 400 }
    );
  }

  // Encrypt and store
  await prisma.user.update({
    where: { id: user.id },
    data: {
      xApiKey: encrypt(xApiKey),
      xApiSecret: encrypt(xApiSecret),
      xAccessToken: encrypt(xAccessToken),
      xAccessTokenSecret: encrypt(xAccessTokenSecret),
    },
  });

  return NextResponse.json({
    success: true,
    username: verification.username,
  });
}

export async function DELETE() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      xApiKey: null,
      xApiSecret: null,
      xAccessToken: null,
      xAccessTokenSecret: null,
    },
  });

  return NextResponse.json({ success: true });
}
