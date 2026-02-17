import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scrapeUrl } from "@/lib/scraper";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const sources = await prisma.knowledgeSource.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(sources);
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const { url, name } = body;

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
      content: scrapeResult.content || "",
      pagesScraped: scrapeResult.pagesScraped || 1,
      lastScraped: new Date(),
      userId: user.id,
    },
  });

  return NextResponse.json(source);
}
