import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { TOPUP_OPTIONS } from "@/lib/stripe";
import {
  assertWeChatConfigReady,
  createWeChatNativeOrder,
} from "@/lib/wechat-pay";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  try {
    assertWeChatConfigReady();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.startsWith("MISSING_ENV:")
            ? `WeChat config missing: ${error.message.replace("MISSING_ENV:", "")}`
            : "WeChat Pay is not configured",
      },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    amountCents?: number;
  };
  const amountCents = Number(body.amountCents);
  const option = TOPUP_OPTIONS.find((item) => item.amountCents === amountCents);
  if (!option) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  try {
    const order = await createWeChatNativeOrder({
      userId: user.id,
      amountCents: option.amountCents,
    });

    return NextResponse.json({
      outTradeNo: order.outTradeNo,
      codeUrl: order.codeUrl,
    });
  } catch (error) {
    console.error("WeChat checkout failed:", error);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Failed to create WeChat order: ${error instanceof Error ? error.message : String(error)}`
            : "Failed to create WeChat order",
      },
      { status: 500 },
    );
  }
}
