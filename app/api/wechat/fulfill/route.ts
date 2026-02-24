import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { addCredits } from "@/lib/credits";
import { queryWeChatOrderByOutTradeNo } from "@/lib/wechat-pay";

export const runtime = "nodejs";

function parseAttach(attach: string | null) {
  if (!attach) return null;
  try {
    const parsed = JSON.parse(attach) as {
      userId?: unknown;
      amountCents?: unknown;
      source?: unknown;
    };
    const userId = typeof parsed.userId === "string" ? parsed.userId : null;
    const amountCents =
      typeof parsed.amountCents === "number" &&
      Number.isFinite(parsed.amountCents)
        ? parsed.amountCents
        : null;
    const source = typeof parsed.source === "string" ? parsed.source : null;
    return { userId, amountCents, source };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => ({}))) as {
    outTradeNo?: string;
  };
  const outTradeNo =
    typeof body.outTradeNo === "string" ? body.outTradeNo.trim() : "";
  if (!outTradeNo) {
    return NextResponse.json({ error: "Missing outTradeNo" }, { status: 400 });
  }

  try {
    const order = await queryWeChatOrderByOutTradeNo(outTradeNo);

    if (order.tradeState !== "SUCCESS") {
      return NextResponse.json(
        {
          error: `Payment not completed (${order.tradeState})`,
          retryable: true,
        },
        { status: 409 },
      );
    }

    const attach = parseAttach(order.attach);
    const attachUserId = attach?.userId ?? null;
    const amountCents = attach?.amountCents ?? order.amountTotal;

    if (!attachUserId || attachUserId !== user.id) {
      return NextResponse.json(
        { error: "Order/user mismatch" },
        { status: 403 },
      );
    }

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json(
        { error: "Invalid payment amount" },
        { status: 400 },
      );
    }

    await addCredits({
      userId: user.id,
      amountCents,
      stripeSessionId: `wechat_${order.transactionId ?? outTradeNo}`,
      description: "WeChat Pay top-up",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WeChat fulfill failed:", error);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `WeChat fulfill failed: ${error instanceof Error ? error.message : String(error)}`
            : "WeChat fulfill failed",
      },
      { status: 500 },
    );
  }
}
