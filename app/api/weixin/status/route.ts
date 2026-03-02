import { NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const connected = !!user.weixinCookie;

  return NextResponse.json({ connected });
}
