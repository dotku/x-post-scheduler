import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scrapeUrl } from "@/lib/scraper";

export async function GET() {
  const sources = await prisma.knowledgeSource.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(sources);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url, name } = body;

  if (!url || !name) {
    return NextResponse.json(
      { error: "URL and name are required" },
      { status: 400 }
    );
  }

  // Check if URL already exists
  const existing = await prisma.knowledgeSource.findUnique({
    where: { url },
  });

  if (existing) {
    return NextResponse.json(
      { error: "This URL already exists in your knowledge base" },
      { status: 400 }
    );
  }

  // Scrape the URL
  const scrapeResult = await scrapeUrl(url);

  if (!scrapeResult.success) {
    return NextResponse.json(
      { error: `Failed to scrape URL: ${scrapeResult.error}` },
      { status: 400 }
    );
  }

  // Create the knowledge source
  const source = await prisma.knowledgeSource.create({
    data: {
      url,
      name,
      content: scrapeResult.content || "",
      pagesScraped: scrapeResult.pagesScraped || 1,
      lastScraped: new Date(),
    },
  });

  return NextResponse.json(source);
}
