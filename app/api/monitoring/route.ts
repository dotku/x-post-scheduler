import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { isTierAtLeast } from "@/lib/subscription";

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { subscriptionTier: true, subscriptionStatus: true },
  });
  if (
    !isTierAtLeast(dbUser?.subscriptionTier, "silver") ||
    dbUser?.subscriptionStatus !== "active"
  ) {
    return NextResponse.json(
      { error: "TIER_REQUIRED", minTier: "silver" },
      { status: 403 },
    );
  }

  const topics = await prisma.monitorTopic.findMany({
    where: { userId: user.id },
    include: {
      _count: { select: { snapshots: true } },
      snapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(topics);
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { subscriptionTier: true, subscriptionStatus: true },
  });
  if (
    !isTierAtLeast(dbUser?.subscriptionTier, "silver") ||
    dbUser?.subscriptionStatus !== "active"
  ) {
    return NextResponse.json(
      { error: "TIER_REQUIRED", minTier: "silver" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { name, nameZh, description, keywords } = body as {
    name: string;
    nameZh?: string;
    description?: string;
    keywords: string[];
  };

  if (!name?.trim() || !Array.isArray(keywords) || keywords.length === 0) {
    return NextResponse.json(
      { error: "Name and at least one keyword required" },
      { status: 400 },
    );
  }

  try {
    const topic = await prisma.monitorTopic.create({
      data: {
        name: name.trim(),
        nameZh: nameZh?.trim() || null,
        description: description?.trim() || null,
        keywords: JSON.stringify(keywords.map((k: string) => k.trim()).filter(Boolean)),
        userId: user.id,
      },
    });
    return NextResponse.json(topic, { status: 201 });
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "A topic with this name already exists" },
        { status: 409 },
      );
    }
    throw err;
  }
}
