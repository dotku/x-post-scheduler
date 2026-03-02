import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
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
      include: {
        materials: {
          include: {
            knowledgeSource: {
              select: { id: true, name: true, url: true, type: true, content: true },
            },
            knowledgeImage: {
              select: { id: true, blobUrl: true, altText: true, mimeType: true, mediaType: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        attachments: {
          select: { id: true, fileName: true, fileType: true, fileSize: true, blobUrl: true, note: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Fetch payment info for owner
    const payment = await prisma.campaignPayment.findUnique({
      where: { campaignId: campaign.id },
      select: {
        clientName: true,
        clientEmail: true,
        paymentStatus: true,
        budgetCents: true,
        platformFeeCents: true,
        totalChargeCents: true,
        ownerPayoutCents: true,
        paidAt: true,
      },
    });

    return NextResponse.json({ ...campaign, payment: payment ?? null });
  } catch (error) {
    console.error("[campaigns] GET by id error:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const existing = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = body.name.trim();
    if (body.client !== undefined) data.client = body.client?.trim() || null;
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.status !== undefined) data.status = body.status;
    if (body.budgetCents !== undefined) data.budgetCents = body.budgetCents ? parseInt(body.budgetCents, 10) : null;
    if (body.budgetNote !== undefined) data.budgetNote = body.budgetNote?.trim() || null;
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.enableShare === true) data.shareToken = crypto.randomUUID();
    if (body.enableShare === false) data.shareToken = null;

    const campaign = await prisma.campaign.update({
      where: { id },
      data,
    });

    return NextResponse.json(campaign);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "A campaign with this name already exists" },
        { status: 409 }
      );
    }
    console.error("[campaigns] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const existing = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    await prisma.campaign.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[campaigns] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
