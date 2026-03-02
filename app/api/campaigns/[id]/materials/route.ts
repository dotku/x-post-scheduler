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
    const { knowledgeSourceId, knowledgeImageId, note } = body;

    if (!knowledgeSourceId && !knowledgeImageId) {
      return NextResponse.json(
        { error: "Either knowledgeSourceId or knowledgeImageId is required" },
        { status: 400 }
      );
    }

    const material = await prisma.campaignMaterial.create({
      data: {
        campaignId: id,
        knowledgeSourceId: knowledgeSourceId || null,
        knowledgeImageId: knowledgeImageId || null,
        note: note?.trim() || null,
      },
      include: {
        knowledgeSource: {
          select: { id: true, name: true, url: true, type: true },
        },
        knowledgeImage: {
          select: { id: true, blobUrl: true, altText: true, mimeType: true, mediaType: true },
        },
      },
    });

    return NextResponse.json(material, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "This material is already linked to the campaign" },
        { status: 409 }
      );
    }
    console.error("[campaigns/materials] POST error:", error);
    return NextResponse.json(
      { error: "Failed to add material" },
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
  const materialId = request.nextUrl.searchParams.get("materialId");

  if (!materialId) {
    return NextResponse.json(
      { error: "materialId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    await prisma.campaignMaterial.delete({
      where: { id: materialId, campaignId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[campaigns/materials] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to remove material" },
      { status: 500 }
    );
  }
}
