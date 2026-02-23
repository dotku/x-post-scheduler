import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { commentId } = await params;

  const comment = await prisma.galleryComment.findUnique({
    where: { id: commentId },
  });
  if (!comment || comment.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.galleryComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
