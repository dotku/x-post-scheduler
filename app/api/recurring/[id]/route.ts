import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

export async function DELETE(
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

  const schedule = await prisma.recurringSchedule.findFirst({
    where: { id, userId: user.id },
  });

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  await prisma.recurringSchedule.delete({ where: { id } });
  return NextResponse.json({ success: true });
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
  const body = await request.json();
  const updateData: {
    isActive?: boolean;
    content?: string;
    useAi?: boolean;
    aiPrompt?: string | null;
    aiLanguage?: string | null;
  } = {};

  if ("isActive" in body) {
    updateData.isActive = Boolean(body.isActive);
  }

  if ("useAi" in body) {
    updateData.useAi = Boolean(body.useAi);
  }

  if ("content" in body) {
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content && !updateData.useAi) {
      return NextResponse.json(
        { error: "Content is required for non-AI schedules" },
        { status: 400 }
      );
    }
    if (content.length > 280) {
      return NextResponse.json(
        { error: "Content exceeds 280 characters" },
        { status: 400 }
      );
    }
    updateData.content = content;
  }

  if ("aiPrompt" in body) {
    const aiPrompt =
      typeof body.aiPrompt === "string" ? body.aiPrompt.trim() : "";
    if (aiPrompt.length > 500) {
      return NextResponse.json(
        { error: "AI prompt exceeds 500 characters" },
        { status: 400 }
      );
    }
    updateData.aiPrompt = aiPrompt || null;
  }

  if ("aiLanguage" in body) {
    const aiLanguage =
      typeof body.aiLanguage === "string" ? body.aiLanguage.trim() : "";
    updateData.aiLanguage = aiLanguage || null;
  }

  const existing = await prisma.recurringSchedule.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No valid fields provided" },
      { status: 400 }
    );
  }

  if ("useAi" in updateData) {
    if (updateData.useAi) {
      if (!("content" in updateData)) {
        updateData.content = "";
      }
    } else {
      const nextContent =
        "content" in updateData ? updateData.content : existing.content;
      if (!nextContent) {
        return NextResponse.json(
          { error: "Content is required for non-AI schedules" },
          { status: 400 }
        );
      }
      updateData.aiPrompt = null;
      updateData.aiLanguage = null;
    }
  }

  const schedule = await prisma.recurringSchedule.update({
    where: { id },
    data: updateData,
  });
  return NextResponse.json(schedule);
}
