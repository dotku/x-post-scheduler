import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scrapeUrl } from "@/lib/scraper";
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

    return NextResponse.json(updated);
  }

  const updated = await prisma.knowledgeSource.update({
    where: { id },
    data: body,
  });
  return NextResponse.json(updated);
}
