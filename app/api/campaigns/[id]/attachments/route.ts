import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

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
    const { blobUrl, fileName, fileType, fileSize, note } = body;

    if (!blobUrl || !fileName || !fileType || !fileSize) {
      return NextResponse.json(
        { error: "blobUrl, fileName, fileType, and fileSize are required" },
        { status: 400 }
      );
    }

    const attachment = await prisma.campaignAttachment.create({
      data: {
        campaignId: id,
        userId: user.id,
        blobUrl,
        fileName,
        fileType,
        fileSize,
        note: note?.trim() || null,
      },
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error("[campaigns/attachments] POST error:", error);
    return NextResponse.json(
      { error: "Failed to add attachment" },
      { status: 500 }
    );
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
  const attachmentId = request.nextUrl.searchParams.get("attachmentId");

  if (!attachmentId) {
    return NextResponse.json({ error: "attachmentId is required" }, { status: 400 });
  }

  try {
    const attachment = await prisma.campaignAttachment.findFirst({
      where: { id: attachmentId, campaignId: id, userId: user.id },
    });
    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    await prisma.campaignAttachment.delete({ where: { id: attachmentId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[campaigns/attachments] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to remove attachment" },
      { status: 500 }
    );
  }
}
