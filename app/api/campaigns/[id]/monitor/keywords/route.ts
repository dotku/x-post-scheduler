import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const keywords = await prisma.monitorKeyword.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ keywords });
  } catch (error) {
    console.error("[monitor/keywords] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch keywords" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await request.json();
    const { keyword, type = "track" } = body;

    if (!keyword || typeof keyword !== "string" || !keyword.trim()) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
    }

    const validTypes = ["track", "negative", "competitor"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid keyword type" }, { status: 400 });
    }

    const created = await prisma.monitorKeyword.create({
      data: {
        keyword: keyword.trim(),
        type,
        campaignId: id,
      },
    });

    return NextResponse.json({ success: true, keyword: created });
  } catch (error) {
    // Handle unique constraint violation
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "Keyword already exists for this campaign" },
        { status: 409 }
      );
    }
    console.error("[monitor/keywords] POST error:", error);
    return NextResponse.json({ error: "Failed to add keyword" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;
  const keywordId = request.nextUrl.searchParams.get("keywordId");

  if (!keywordId) {
    return NextResponse.json({ error: "keywordId is required" }, { status: 400 });
  }

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    await prisma.monitorKeyword.delete({
      where: { id: keywordId, campaignId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[monitor/keywords] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete keyword" }, { status: 500 });
  }
}
