import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: itemId } = await params;

  const item = await prisma.galleryItem.findUnique({
    where: { id: itemId },
    select: { isPublic: true },
  });
  if (!item?.isPublic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const limit = 20;

  const comments = await prisma.galleryComment.findMany({
    where: { itemId },
    orderBy: { createdAt: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      user: { select: { name: true, picture: true } },
    },
  });

  const hasMore = comments.length > limit;
  const page = hasMore ? comments.slice(0, limit) : comments;
  return NextResponse.json({
    comments: page,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}

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

  const { id: itemId } = await params;

  const item = await prisma.galleryItem.findUnique({
    where: { id: itemId },
    select: { isPublic: true },
  });
  if (!item?.isPublic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content || content.length > 280) {
    return NextResponse.json({ error: "Content must be 1–280 characters" }, { status: 400 });
  }

  const comment = await prisma.galleryComment.create({
    data: { itemId, userId: user.id, content },
    include: { user: { select: { name: true, picture: true } } },
  });

  return NextResponse.json({ comment });
}
