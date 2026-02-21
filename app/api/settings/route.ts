import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { encrypt } from "@/lib/encryption";
import { verifyCredentials } from "@/lib/x-client";
import { listUserXAccounts } from "@/lib/user-credentials";

function parseBool(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return false;
}

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const [accounts, legacyUser] = await Promise.all([
    listUserXAccounts(user.id),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        xApiKey: true,
        xApiSecret: true,
        xAccessToken: true,
        xAccessTokenSecret: true,
      },
    }),
  ]);

  const hasLegacyCredentials = !!(
    legacyUser?.xApiKey &&
    legacyUser?.xApiSecret &&
    legacyUser?.xAccessToken &&
    legacyUser?.xAccessTokenSecret
  );

  return NextResponse.json({
    hasCredentials: accounts.length > 0 || hasLegacyCredentials,
    accounts,
  });
}

async function createAccount(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const { xApiKey, xApiSecret, xAccessToken, xAccessTokenSecret, label } = body;
  const setAsDefault = parseBool(body.setAsDefault);

  if (!xApiKey || !xApiSecret || !xAccessToken || !xAccessTokenSecret) {
    return NextResponse.json(
      { error: "All four credential fields are required" },
      { status: 400 }
    );
  }

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

  const existingCount = await prisma.xAccount.count({ where: { userId: user.id } });
  const shouldBeDefault = setAsDefault || existingCount === 0;

  const account = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx.xAccount.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.xAccount.create({
      data: {
        userId: user.id,
        label: typeof label === "string" ? label.trim() || null : null,
        username: verification.username ?? null,
        isDefault: shouldBeDefault,
        xApiKey: encrypt(xApiKey),
        xApiSecret: encrypt(xApiSecret),
        xAccessToken: encrypt(xAccessToken),
        xAccessTokenSecret: encrypt(xAccessTokenSecret),
      },
      select: {
        id: true,
        label: true,
        username: true,
        isDefault: true,
        createdAt: true,
      },
    });
  });

  return NextResponse.json({
    success: true,
    username: verification.username,
    account,
  });
}

export async function POST(request: NextRequest) {
  return createAccount(request);
}

// Backward compatibility for previous UI that used PUT.
export async function PUT(request: NextRequest) {
  return createAccount(request);
}

export async function PATCH(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const accountId = typeof body.accountId === "string" ? body.accountId : "";
  if (!accountId) {
    return NextResponse.json(
      { error: "accountId is required" },
      { status: 400 }
    );
  }

  const existing = await prisma.xAccount.findFirst({
    where: { id: accountId, userId: user.id },
    select: { id: true, isDefault: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // If credentials are provided, update them
  const { xApiKey, xApiSecret, xAccessToken, xAccessTokenSecret, label } = body;
  if (xApiKey || xApiSecret || xAccessToken || xAccessTokenSecret) {
    if (!xApiKey || !xApiSecret || !xAccessToken || !xAccessTokenSecret) {
      return NextResponse.json(
        { error: "All four credential fields are required to update keys" },
        { status: 400 }
      );
    }

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

    await prisma.xAccount.update({
      where: { id: accountId },
      data: {
        xApiKey: encrypt(xApiKey),
        xApiSecret: encrypt(xApiSecret),
        xAccessToken: encrypt(xAccessToken),
        xAccessTokenSecret: encrypt(xAccessTokenSecret),
        username: verification.username ?? undefined,
        ...(typeof label === "string" ? { label: label.trim() || null } : {}),
      },
    });

    return NextResponse.json({ success: true, username: verification.username });
  }

  // Otherwise just set as default
  await prisma.$transaction([
    prisma.xAccount.updateMany({
      where: { userId: user.id, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.xAccount.update({
      where: { id: accountId },
      data: { isDefault: true },
    }),
  ]);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const accountId = request.nextUrl.searchParams.get("accountId");

  if (!accountId) {
    await Promise.all([
      prisma.xAccount.deleteMany({ where: { userId: user.id } }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          xApiKey: null,
          xApiSecret: null,
          xAccessToken: null,
          xAccessTokenSecret: null,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  }

  const account = await prisma.xAccount.findFirst({
    where: { id: accountId, userId: user.id },
    select: { id: true, isDefault: true },
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await prisma.xAccount.delete({ where: { id: account.id } });

  if (account.isDefault) {
    const replacement = await prisma.xAccount.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (replacement) {
      await prisma.xAccount.update({
        where: { id: replacement.id },
        data: { isDefault: true },
      });
    }
  }

  return NextResponse.json({ success: true });
}
