import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
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
  const { type, modelId, modelLabel, prompt, sourceUrl, aspectRatio } = body as {
    type: "image" | "video";
    modelId: string;
    modelLabel: string;
    prompt: string;
    sourceUrl: string;
    aspectRatio?: string;
  };

  if (!sourceUrl || !prompt || !modelId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const item = await saveToGallery({
      userId: user.id,
      type,
      modelId,
      modelLabel,
      prompt,
      sourceUrl,
      aspectRatio,
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
