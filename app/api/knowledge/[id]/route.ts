import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scrapeUrl } from "@/lib/scraper";
import { syncKnowledgeSourceImages } from "@/lib/knowledge-images";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

export async function GET(
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

  const source = await prisma.knowledgeSource.findFirst({
    where: { id, userId: user.id },
    include: {
      images: {
        select: { id: true, blobUrl: true, altText: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      _count: { select: { images: true } },
    },
  });

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  return NextResponse.json(source);
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

  const source = await prisma.knowledgeSource.findFirst({
    where: { id, userId: user.id },
  });

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  await prisma.knowledgeSource.delete({ where: { id } });
  return NextResponse.json({ success: true });
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
  const body = await request.json();

  const source = await prisma.knowledgeSource.findFirst({
    where: { id, userId: user.id },
  });

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  if (body.rescrape) {
    const scrapeResult = await scrapeUrl(source.url);

    if (!scrapeResult.success) {
      return NextResponse.json(
        { error: `Failed to scrape: ${scrapeResult.error}` },
        { status: 400 }
      );
    }

    const updated = await prisma.knowledgeSource.update({
      where: { id },
      data: {
        content: scrapeResult.content || "",
        pagesScraped: scrapeResult.pagesScraped || 1,
        lastScraped: new Date(),
      },
    });

    const imagesResult = await syncKnowledgeSourceImages({
      userId: user.id,
      knowledgeSourceId: id,
      images: scrapeResult.images || [],
    });

    const withImages = await prisma.knowledgeSource.findUnique({
      where: { id },
      include: {
        images: {
          select: { id: true, blobUrl: true, altText: true },
          orderBy: { createdAt: "desc" },
          take: 8,
        },
        _count: { select: { images: true } },
      },
    });

    return NextResponse.json({
      ...updated,
      images: withImages?.images || [],
      _count: withImages?._count || { images: 0 },
      imageSync: imagesResult,
    });
  }

  const updated = await prisma.knowledgeSource.update({
    where: { id },
    data: body,
  });
  return NextResponse.json(updated);
}
