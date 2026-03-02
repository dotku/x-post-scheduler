import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import {
  getOrCreateConnectAccount,
  createAccountLink,
  syncConnectStatus,
  getAvailableBalance,
} from "@/lib/stripe-connect";

// GET: Connect account status + available balance
export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  try {
    const [connectStatus, balance] = await Promise.all([
      syncConnectStatus(user.id),
      getAvailableBalance(user.id),
    ]);

    return NextResponse.json({ ...connectStatus, ...balance });
  } catch (error) {
    console.error("[stripe/connect] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch connect status" },
      { status: 500 }
    );
  }
}

// POST: Create Connect account + generate onboarding URL
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  try {
    const origin =
      process.env.NEXT_PUBLIC_APP_LOCAL_URL ??
      process.env.APP_BASE_URL ??
      request.headers.get("origin") ??
      "http://localhost:3000";

    const accountId = await getOrCreateConnectAccount(user.id, user.email);
    const url = await createAccountLink(accountId, origin);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[stripe/connect] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create connect account" },
      { status: 500 }
    );
  }
}
