import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getQrLoginStatus } from "@/lib/weixin-worker-client";

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  try {
    const result = await getQrLoginStatus(sessionId);

    if (!result || !result.status) {
      return NextResponse.json({ status: "pending", message: "Waiting..." });
    }

    // On success, store cookies in user record
    if (result.status === "success" && result.cookies) {
      const { prisma } = await import("@/lib/db");
      await prisma.user.update({
        where: { id: user.id },
        data: { weixinCookie: JSON.stringify(result.cookies) },
      });
    }

    return NextResponse.json({
      status: result.status,
      message: result.message,
      // Don't expose raw cookies to client
      hasCookies: result.status === "success" && !!result.cookies,
    });
  } catch (error) {
    console.error("[weixin/qr-login/status] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check status" },
      { status: 502 }
    );
  }
}
