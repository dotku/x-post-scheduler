import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { isTierAtLeast } from "@/lib/subscription";

async function checkTier(userId: string) {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true, subscriptionStatus: true },
  });
  return (
    isTierAtLeast(dbUser?.subscriptionTier, "silver") &&
    dbUser?.subscriptionStatus === "active"
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }
  if (!(await checkTier(user.id))) {
    return NextResponse.json({ error: "TIER_REQUIRED" }, { status: 403 });
  }

  const { id } = await params;
  const topic = await prisma.monitorTopic.findFirst({
    where: { id, userId: user.id },
    include: {
      snapshots: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }
  return NextResponse.json(topic);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }
  if (!(await checkTier(user.id))) {
    return NextResponse.json({ error: "TIER_REQUIRED" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, nameZh, description, keywords } = body as {
    name?: string;
    nameZh?: string;
    description?: string;
    keywords?: string[];
  };

  const existing = await prisma.monitorTopic.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name.trim();
  if (nameZh !== undefined) data.nameZh = nameZh.trim() || null;
  if (description !== undefined) data.description = description.trim() || null;
  if (keywords !== undefined) {
    data.keywords = JSON.stringify(
      keywords.map((k: string) => k.trim()).filter(Boolean),
    );
  }

  const updated = await prisma.monitorTopic.update({
    where: { id },
    data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }
  if (!(await checkTier(user.id))) {
    return NextResponse.json({ error: "TIER_REQUIRED" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.monitorTopic.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  await prisma.monitorTopic.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
