import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = request.nextUrl.searchParams.get("period");
  if (period !== "daily" && period !== "weekly") {
    return NextResponse.json(
      { error: "Invalid period. Use daily or weekly." },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$executeRaw`
      DELETE FROM "MediaIndustryReport" WHERE "period" = ${period}
    `;
    return NextResponse.json({ success: true, period, deleted: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handle(request);
}
