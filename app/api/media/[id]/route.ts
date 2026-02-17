import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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

  const asset = await prisma.mediaAsset.findFirst({
    where: { id, userId: user.id },
  });

  if (!asset) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  return new NextResponse(asset.data, {
    headers: {
      "Content-Type": asset.mimeType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
