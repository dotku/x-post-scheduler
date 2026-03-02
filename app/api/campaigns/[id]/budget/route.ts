import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { analyzeBudget } from "@/lib/campaign-analysis";
import { hasCredits, deductCredits } from "@/lib/credits";
import { trackTokenUsage } from "@/lib/usage-tracking";

export const maxDuration = 60;

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
    const hasCreds = await hasCredits(user.id);
    if (!hasCreds) {
      return NextResponse.json(
        { error: "Insufficient credits" },
        { status: 402 }
      );
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
      include: {
        materials: {
          include: {
            knowledgeSource: {
              select: { name: true, content: true, type: true, url: true },
            },
            knowledgeImage: {
              select: { altText: true, mediaType: true },
            },
          },
        },
        attachments: {
          select: { fileName: true, fileType: true, fileSize: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const modelId = body.modelId as string | undefined;

    const result = await analyzeBudget({
      name: campaign.name,
      client: campaign.client,
      description: campaign.description,
      budgetCents: campaign.budgetCents,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      notes: campaign.notes,
      materials: campaign.materials.map((m) => ({
        sourceName: m.knowledgeSource?.name,
        sourceContent: m.knowledgeSource?.content,
        sourceType: m.knowledgeSource?.type,
        sourceUrl: m.knowledgeSource?.url,
        imageAlt: m.knowledgeImage?.altText,
        imageType: m.knowledgeImage?.mediaType,
        note: m.note,
      })),
      attachments: campaign.attachments?.map((a: { fileName: string; fileType: string; fileSize: number }) => ({
        fileName: a.fileName,
        fileType: a.fileType,
        fileSize: a.fileSize,
      })),
      modelId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Budget analysis failed" },
        { status: 500 }
      );
    }

    if (result.usage) {
      await deductCredits({
        userId: user.id,
        usage: result.usage,
        model: result.modelId,
        source: "campaign-budget",
      });

      await trackTokenUsage({
        userId: user.id,
        source: "campaign-budget",
        model: result.modelId,
        usage: result.usage,
      });
    }

    await prisma.campaign.update({
      where: { id },
      data: {
        aiBudget: JSON.stringify(result.budget),
        aiBudgetAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      budget: result.budget,
      modelId: result.modelId,
    });
  } catch (error) {
    console.error("[campaigns/budget] POST error:", error);
    return NextResponse.json(
      { error: "Failed to generate budget" },
      { status: 500 }
    );
  }
}
