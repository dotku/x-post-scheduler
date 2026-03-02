import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { randomBytes } from "crypto";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }
  const { snapshotId } = await params;

  // Verify ownership: snapshot → topic → user
  const snapshot = await prisma.topicSnapshot.findUnique({
    where: { id: snapshotId },
    include: { topic: { select: { userId: true, name: true } } },
  });

  if (!snapshot || snapshot.topic.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If already shared, return existing publicId
  if (snapshot.publicId) {
    return NextResponse.json({ publicId: snapshot.publicId });
  }

  // Generate a short unique public ID
  const publicId = randomBytes(8).toString("base64url");

  await prisma.topicSnapshot.update({
    where: { id: snapshotId },
    data: { publicId },
  });

  return NextResponse.json({ publicId });
}
