import { NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { startQrLogin } from "@/lib/weixin-worker-client";

export async function POST() {
  try {
    await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  try {
    const result = await startQrLogin();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[weixin/qr-login] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start QR login" },
      { status: 502 }
    );
  }
}
