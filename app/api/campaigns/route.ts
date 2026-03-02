import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  try {
    const campaigns = await prisma.campaign.findMany({
      where: { userId: user.id },
      include: {
        _count: { select: { materials: true, attachments: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(campaigns);
  } catch (error) {
    console.error("[campaigns] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { name, client, description, status, budgetCents, budgetNote, startDate, endDate, knowledgeSourceIds, attachments } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Campaign name is required" },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.create({
      data: {
        name: name.trim(),
        client: client?.trim() || null,
        description: description?.trim() || null,
        status: status || "draft",
        budgetCents: budgetCents != null ? Math.round(Number(budgetCents)) : null,
        budgetNote: budgetNote?.trim() || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        userId: user.id,
      },
    });

    if (Array.isArray(knowledgeSourceIds) && knowledgeSourceIds.length > 0) {
      await prisma.campaignMaterial.createMany({
        data: knowledgeSourceIds.map((ksId: string) => ({
          campaignId: campaign.id,
          knowledgeSourceId: ksId,
        })),
        skipDuplicates: true,
      });
    }

    if (Array.isArray(attachments) && attachments.length > 0) {
      await prisma.campaignAttachment.createMany({
        data: attachments.map((att: { blobUrl: string; fileName: string; fileType: string; fileSize: number }) => ({
          campaignId: campaign.id,
          userId: user.id,
          blobUrl: att.blobUrl,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
        })),
      });
    }

    return NextResponse.json(campaign, { status: 201 });
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[campaigns] POST error:", errorMessage, error);
    return NextResponse.json(
      { error: `Failed to create campaign: ${errorMessage}` },
      { status: 500 }
    );
  }
}
