import { NextRequest, NextResponse } from "next/server";
import { isGuestSessionUser, requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { saveToGallery } from "@/lib/gallery";
import { prisma } from "@/lib/db";

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const items = await prisma.galleryItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const {
    type,
    modelId,
    modelLabel,
    prompt,
    sourceUrl,
    inputImageUrl,
    generationMeta,
    aspectRatio,
    isPublic,
  } = body as {
    type: "image" | "video";
    modelId: string;
    modelLabel: string;
    prompt: string;
    sourceUrl: string;
    inputImageUrl?: string;
    generationMeta?: unknown;
    aspectRatio?: string;
    isPublic?: boolean;
  };

  if (!sourceUrl || !prompt || !modelId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const isGuest = await isGuestSessionUser();
    const item = await saveToGallery({
      userId: user.id,
      type,
      modelId,
      modelLabel,
      prompt,
      sourceUrl,
      inputImageUrl: inputImageUrl?.trim() || undefined,
      generationMeta,
      aspectRatio,
      isPublic: isGuest ? true : typeof isPublic === "boolean" ? isPublic : true,
    });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("Gallery save error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save" },
      { status: 500 }
    );
  }
}
