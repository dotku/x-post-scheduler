import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { shareToken: token },
      include: {
        materials: {
          include: {
            knowledgeSource: {
              select: { name: true, url: true, type: true },
            },
            knowledgeImage: {
              select: { blobUrl: true, altText: true, mediaType: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        attachments: {
          select: { fileName: true, fileType: true, fileSize: true, blobUrl: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Fetch payment status
    const payment = await prisma.campaignPayment.findUnique({
      where: { campaignId: campaign.id },
      select: { paymentStatus: true, clientName: true, paidAt: true },
    });

    // Return read-only data — omit userId, internal IDs, raw content
    return NextResponse.json({
      name: campaign.name,
      client: campaign.client,
      description: campaign.description,
      status: campaign.status,
      budgetCents: campaign.budgetCents,
      budgetNote: campaign.budgetNote,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      notes: campaign.notes,
      aiAnalysis: campaign.aiAnalysis,
      aiAnalyzedAt: campaign.aiAnalyzedAt,
      aiBudget: campaign.aiBudget,
      aiBudgetAt: campaign.aiBudgetAt,
      materials: campaign.materials.map((m) => ({
        knowledgeSource: m.knowledgeSource
          ? { name: m.knowledgeSource.name, url: m.knowledgeSource.url, type: m.knowledgeSource.type }
          : null,
        knowledgeImage: m.knowledgeImage
          ? { blobUrl: m.knowledgeImage.blobUrl, altText: m.knowledgeImage.altText, mediaType: m.knowledgeImage.mediaType }
          : null,
        note: m.note,
      })),
      attachments: campaign.attachments,
      paymentStatus: payment?.paymentStatus ?? null,
      paidAt: payment?.paidAt ?? null,
      clientSignedName: payment?.paymentStatus === "paid" ? payment.clientName : null,
    });
  } catch (error) {
    console.error("[campaigns/share] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shared campaign" },
      { status: 500 }
    );
  }
}
