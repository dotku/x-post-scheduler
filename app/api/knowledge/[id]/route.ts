import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scrapeUrl, ScrapeResult } from "@/lib/scraper";
import { scrapeWeixinChannel, scrapeWeixinChannelWithWorker } from "@/lib/weixin-channel";
import { syncKnowledgeSourceImages, syncKnowledgeSourceThumbnails } from "@/lib/knowledge-images";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

// Worker-based scraping can take 2-3 minutes (slow TLS + page rendering)
export const maxDuration = 300;

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
        select: { id: true, blobUrl: true, altText: true, mimeType: true, mediaType: true, duration: true, thumbnailBlobUrl: true },
        orderBy: { createdAt: "desc" },
        take: 12,
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
    let scrapeResult: ScrapeResult;
    if (source.type === "weixin_channel") {
      const channelId = source.url.replace("weixin-channel://", "");
      scrapeResult = user.weixinCookie
        ? await scrapeWeixinChannelWithWorker(channelId, user.weixinCookie, user.id)
        : await scrapeWeixinChannel(channelId, source.name);
    } else {
      scrapeResult = await scrapeUrl(source.url);
    }

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
        metadata: scrapeResult.videos ? JSON.stringify({ videos: scrapeResult.videos }) : null,
        pagesScraped: scrapeResult.pagesScraped || 1,
        lastScraped: new Date(),
      },
    });

    const imagesResult = await syncKnowledgeSourceImages({
      userId: user.id,
      knowledgeSourceId: id,
      images: scrapeResult.images || [],
    });

    if (scrapeResult.thumbnails && scrapeResult.thumbnails.length > 0) {
      await syncKnowledgeSourceThumbnails({
        userId: user.id,
        knowledgeSourceId: id,
        thumbnails: scrapeResult.thumbnails,
      });
    }

    const withImages = await prisma.knowledgeSource.findUnique({
      where: { id },
      include: {
        images: {
          select: { id: true, blobUrl: true, altText: true, mimeType: true, mediaType: true, duration: true, thumbnailBlobUrl: true },
          orderBy: { createdAt: "desc" },
          take: 12,
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
