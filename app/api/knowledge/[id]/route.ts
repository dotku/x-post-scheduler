import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scrapeUrl } from "@/lib/scraper";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const source = await prisma.knowledgeSource.findUnique({
    where: { id },
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
  const { id } = await params;

  try {
    await prisma.knowledgeSource.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // If rescrape is requested
  if (body.rescrape) {
    const source = await prisma.knowledgeSource.findUnique({
      where: { id },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

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

    return NextResponse.json(updated);
  }

  // Regular update (toggle active, update name, etc.)
  try {
    const source = await prisma.knowledgeSource.update({
      where: { id },
      data: body,
    });
    return NextResponse.json(source);
  } catch {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }
}
