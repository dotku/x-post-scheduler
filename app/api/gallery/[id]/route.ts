import { NextRequest, NextResponse } from "next/server";
import { isGuestSessionUser, requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { deleteGalleryItem } from "@/lib/gallery";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await prisma.galleryItem.findUnique({
    where: { id },
    include: { user: { select: { name: true, picture: true } } },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (item.isPublic) {
    return NextResponse.json({ item });
  }

  try {
    const user = await requireAuth();
    if (item.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch {
    return unauthorizedResponse();
  }
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
  const item = await prisma.galleryItem.findUnique({ where: { id } });
  if (!item || item.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { isPublic } = await request.json() as { isPublic: boolean };
  const isGuest = await isGuestSessionUser();
  if (isGuest && !isPublic) {
    return NextResponse.json(
      { error: "Guest-generated content must stay public." },
      { status: 403 }
    );
  }

  const updated = await prisma.galleryItem.update({
    where: { id },
    data: { isPublic },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _request: NextRequest,
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
    await deleteGalleryItem(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete" },
      { status: 400 }
    );
  }
}
