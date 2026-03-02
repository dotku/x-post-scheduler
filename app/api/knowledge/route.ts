import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scrapeUrl } from "@/lib/scraper";
import { scrapeWeixinChannel, scrapeWeixinChannelWithWorker } from "@/lib/weixin-channel";
import { syncKnowledgeSourceImages, syncKnowledgeSourceThumbnails } from "@/lib/knowledge-images";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

// Worker-based scraping can take 2-3 minutes (slow TLS + page rendering)
export const maxDuration = 300;

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  try {
    const sources = await prisma.knowledgeSource.findMany({
      where: { userId: user.id },
      include: {
        images: {
          select: { id: true, blobUrl: true, altText: true, mimeType: true, mediaType: true, duration: true, thumbnailBlobUrl: true },
          orderBy: { createdAt: "desc" },
          take: 12,
        },
        _count: { select: { images: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(sources);
  } catch (error) {
    console.error("[knowledge] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch knowledge sources" },
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

  const body = await request.json();
  const { url, name, type = "website" } = body;

  if (type === "weixin_channel") {
    // For Weixin Channel, `url` is the channel ID
    const channelId = url;
    if (!channelId || !name) {
      return NextResponse.json(
        { error: "Channel ID and name are required" },
        { status: 400 }
      );
    }

    const canonicalUrl = `weixin-channel://${channelId}`;

    const existing = await prisma.knowledgeSource.findFirst({
      where: { url: canonicalUrl, userId: user.id },
    });
    if (existing) {
      return NextResponse.json(
        { error: "This Weixin Channel already exists in your knowledge base" },
        { status: 400 }
      );
    }

    // Use worker-based scraping if user has WeChat cookies
    const scrapeResult = user.weixinCookie
      ? await scrapeWeixinChannelWithWorker(channelId, user.weixinCookie, user.id)
      : await scrapeWeixinChannel(channelId, name);
    if (!scrapeResult.success) {
      return NextResponse.json(
        { error: `Failed to fetch Weixin Channel: ${scrapeResult.error}` },
        { status: 400 }
      );
    }

    const source = await prisma.knowledgeSource.create({
      data: {
        url: canonicalUrl,
        name: scrapeResult.title || name,
        type: "weixin_channel",
        content: scrapeResult.content || "",
        metadata: scrapeResult.videos ? JSON.stringify({ videos: scrapeResult.videos }) : null,
        pagesScraped: scrapeResult.pagesScraped || 1,
        lastScraped: new Date(),
        userId: user.id,
      },
    });

    const imagesResult = await syncKnowledgeSourceImages({
      userId: user.id,
      knowledgeSourceId: source.id,
      images: scrapeResult.images || [],
    });

    if (scrapeResult.thumbnails && scrapeResult.thumbnails.length > 0) {
      await syncKnowledgeSourceThumbnails({
        userId: user.id,
        knowledgeSourceId: source.id,
        thumbnails: scrapeResult.thumbnails,
      });
    }

    const sourceWithImages = await prisma.knowledgeSource.findUnique({
      where: { id: source.id },
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
      ...(sourceWithImages || { ...source, images: [], _count: { images: 0 } }),
      imageSync: imagesResult,
    });
  }

  // Default: website type
  if (!url || !name) {
    return NextResponse.json(
      { error: "URL and name are required" },
      { status: 400 }
    );
  }

  // Check if URL already exists for this user
  const existing = await prisma.knowledgeSource.findFirst({
    where: { url, userId: user.id },
  });

  if (existing) {
    return NextResponse.json(
      { error: "This URL already exists in your knowledge base" },
      { status: 400 }
    );
  }

  const scrapeResult = await scrapeUrl(url);

  if (!scrapeResult.success) {
    return NextResponse.json(
      { error: `Failed to scrape URL: ${scrapeResult.error}` },
      { status: 400 }
    );
  }

  const source = await prisma.knowledgeSource.create({
    data: {
      url,
      name,
      type: "website",
      content: scrapeResult.content || "",
      pagesScraped: scrapeResult.pagesScraped || 1,
      lastScraped: new Date(),
      userId: user.id,
    },
  });

  const imagesResult = await syncKnowledgeSourceImages({
    userId: user.id,
    knowledgeSourceId: source.id,
    images: scrapeResult.images || [],
  });

  const sourceWithImages = await prisma.knowledgeSource.findUnique({
    where: { id: source.id },
    include: {
      images: {
        select: { id: true, blobUrl: true, altText: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      _count: { select: { images: true } },
    },
  });

  if (!sourceWithImages) {
    return NextResponse.json({
      ...source,
      images: [],
      _count: { images: 0 },
      imageSync: imagesResult,
    });
  }

  return NextResponse.json({
    ...sourceWithImages,
    imageSync: imagesResult,
  });
}
