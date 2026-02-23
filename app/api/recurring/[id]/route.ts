import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addDays, addWeeks, addMonths } from "date-fns";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getUserXCredentials } from "@/lib/user-credentials";
import { IMAGE_MODELS } from "@/lib/wavespeed";
import { decodeRecurringAiPrompt, encodeRecurringAiPrompt } from "@/lib/recurring-ai";

function calculateNextRun(frequency: string, cronExpr: string): Date {
  const now = new Date();
  const [hours, minutes] = cronExpr.split(":").map(Number);
  let nextRun = new Date(now);
  nextRun.setHours(hours, minutes, 0, 0);
  if (nextRun <= now) {
    switch (frequency) {
      case "daily": nextRun = addDays(nextRun, 1); break;
      case "weekly": nextRun = addWeeks(nextRun, 1); break;
      case "monthly": nextRun = addMonths(nextRun, 1); break;
    }
  }
  return nextRun;
}

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
    imageModelId?: string | null;
    xAccountId?: string | null;
    cronExpr?: string;
    frequency?: string;
    nextRunAt?: Date;
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

  if ("imageModelId" in body) {
    const imageModelId =
      typeof body.imageModelId === "string" ? body.imageModelId.trim() : "";
    if (imageModelId) {
      const validModel = IMAGE_MODELS.find((model) => model.id === imageModelId);
      if (!validModel) {
        return NextResponse.json(
          { error: "Invalid image model selection" },
          { status: 400 }
        );
      }
      updateData.imageModelId = imageModelId;
    } else {
      updateData.imageModelId = null;
    }
  }

  if ("aiLanguage" in body) {
    const aiLanguage =
      typeof body.aiLanguage === "string" ? body.aiLanguage.trim() : "";
    updateData.aiLanguage = aiLanguage || null;
  }

  if ("xAccountId" in body) {
    const requestedAccountId =
      typeof body.xAccountId === "string" ? body.xAccountId : null;
    const resolved = await getUserXCredentials(user.id, requestedAccountId);
    if (!resolved) {
      return NextResponse.json(
        { error: "Invalid X account selection" },
        { status: 400 }
      );
    }
    updateData.xAccountId = resolved.accountId;
  }

  if ("frequency" in body) {
    const freq = typeof body.frequency === "string" ? body.frequency : "";
    if (!["daily", "weekly", "monthly"].includes(freq)) {
      return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
    }
    updateData.frequency = freq;
  }

  if ("cronExpr" in body) {
    const expr = typeof body.cronExpr === "string" ? body.cronExpr.trim() : "";
    if (!/^\d{1,2}:\d{2}$/.test(expr)) {
      return NextResponse.json({ error: "Invalid time format" }, { status: 400 });
    }
    updateData.cronExpr = expr;
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

  // Image model is stored as prompt metadata for backward-compatible schema.
  if (
    "aiPrompt" in updateData ||
    "imageModelId" in updateData ||
    ("useAi" in updateData && !updateData.useAi)
  ) {
    const existingDecoded = decodeRecurringAiPrompt(existing.aiPrompt);
    const nextUseAi =
      "useAi" in updateData ? Boolean(updateData.useAi) : existing.useAi;

    if (!nextUseAi) {
      updateData.aiPrompt = null;
    } else {
      const nextPrompt =
        "aiPrompt" in updateData ? updateData.aiPrompt : existingDecoded.prompt;
      const nextImageModelId =
        "imageModelId" in updateData
          ? updateData.imageModelId
          : existingDecoded.imageModelId;
      updateData.aiPrompt = encodeRecurringAiPrompt({
        prompt: nextPrompt,
        imageModelId: nextImageModelId,
      });
    }
  }

  delete updateData.imageModelId;

  // Recalculate nextRunAt if time or frequency changed
  if ("cronExpr" in updateData || "frequency" in updateData) {
    const nextFrequency = updateData.frequency ?? existing.frequency;
    const nextCronExpr = updateData.cronExpr ?? existing.cronExpr;
    updateData.nextRunAt = calculateNextRun(nextFrequency, nextCronExpr);
  }

  const schedule = await prisma.recurringSchedule.update({
    where: { id },
    data: updateData,
  });
  const decoded = decodeRecurringAiPrompt(schedule.aiPrompt);
  return NextResponse.json({
    ...schedule,
    aiPrompt: decoded.prompt,
    imageModelId: decoded.imageModelId,
  });
}
