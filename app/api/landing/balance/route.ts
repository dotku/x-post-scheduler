import { NextRequest, NextResponse } from "next/server";
import { getOrCreateTrialUser, getCreditBalance, isDailyTrialCapReached } from "@/lib/credits";
import { getAuthenticatedUser } from "@/lib/auth0";

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  return forwarded ? forwarded.split(",")[0].trim() : cfConnectingIp || "unknown";
}

export async function GET(request: NextRequest) {
  // If logged in, use real balance
  try {
    const user = await getAuthenticatedUser();
    if (user) {
      const balance = await getCreditBalance(user.id);
      return NextResponse.json({ remainingCents: balance, isTrial: false });
    }
  } catch {
    // Not authenticated — fall through to trial
  }

  // Trial user
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  // If platform daily cap reached, return 0 balance
  if (await isDailyTrialCapReached()) {
    return NextResponse.json({ remainingCents: 0, isTrial: true, capReached: true });
  }

  const trialUserId = await getOrCreateTrialUser(clientIp, userAgent);
  const balance = await getCreditBalance(trialUserId);

  return NextResponse.json({ remainingCents: balance, isTrial: true });
}
