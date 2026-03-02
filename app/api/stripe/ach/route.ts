import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import {
  setupAchAccount,
  getAchStatus,
  removeAchAccount,
} from "@/lib/ach-connect";

// GET: ACH account status
export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  try {
    const status = await getAchStatus(user.id);
    return NextResponse.json(status);
  } catch (error) {
    console.error("[stripe/ach] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ACH status" },
      { status: 500 },
    );
  }
}

// POST: Set up ACH bank account
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { accountHolderName, routingNumber, accountNumber, accountType } =
      body;

    if (
      !accountHolderName ||
      typeof accountHolderName !== "string" ||
      !accountHolderName.trim()
    ) {
      return NextResponse.json(
        { error: "Account holder name is required" },
        { status: 400 },
      );
    }
    if (!routingNumber || !/^\d{9}$/.test(routingNumber)) {
      return NextResponse.json(
        { error: "Routing number must be 9 digits" },
        { status: 400 },
      );
    }
    if (!accountNumber || !/^\d{4,17}$/.test(accountNumber)) {
      return NextResponse.json(
        { error: "Invalid account number" },
        { status: 400 },
      );
    }
    if (!["checking", "savings"].includes(accountType)) {
      return NextResponse.json(
        { error: "Account type must be checking or savings" },
        { status: 400 },
      );
    }

    const forwarded = request.headers.get("x-forwarded-for");
    const userIp = forwarded?.split(",")[0]?.trim() || "127.0.0.1";

    const result = await setupAchAccount(
      user.id,
      {
        accountHolderName: accountHolderName.trim(),
        routingNumber,
        accountNumber,
        accountType,
      },
      userIp,
      user.email,
    );

    return NextResponse.json({
      success: true,
      accountId: result.accountId,
      bankLast4: result.bankLast4,
      bankName: result.bankName,
    });
  } catch (error) {
    console.error("[stripe/ach] POST error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to set up ACH";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: Remove ACH setup
export async function DELETE() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  try {
    await removeAchAccount(user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[stripe/ach] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to remove ACH account" },
      { status: 500 },
    );
  }
}
