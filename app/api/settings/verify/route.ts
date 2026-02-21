import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { decrypt } from "@/lib/encryption";
import { verifyCredentials } from "@/lib/x-client";

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  const account = await prisma.xAccount.findFirst({
    where: { id: accountId, userId: user.id },
    select: {
      xApiKey: true,
      xApiSecret: true,
      xAccessToken: true,
      xAccessTokenSecret: true,
    },
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const result = await verifyCredentials({
    apiKey: decrypt(account.xApiKey),
    apiSecret: decrypt(account.xApiSecret),
    accessToken: decrypt(account.xAccessToken),
    accessTokenSecret: decrypt(account.xAccessTokenSecret),
  });

  return NextResponse.json({
    valid: result.valid,
    username: result.username ?? null,
    error: result.error ?? null,
  });
}
