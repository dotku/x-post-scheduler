import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

export async function POST(
  _request: NextRequest,
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
    select: { id: true, isPublic: true },
  });
  if (!item || !item.isPublic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.galleryLike.findUnique({
    where: { itemId_userId: { itemId, userId: user.id } },
  });

  if (existing) {
    await prisma.galleryLike.delete({
      where: { itemId_userId: { itemId, userId: user.id } },
    });
  } else {
    await prisma.galleryLike.create({ data: { itemId, userId: user.id } });
  }

  const count = await prisma.galleryLike.count({ where: { itemId } });
  return NextResponse.json({ liked: !existing, count });
}
