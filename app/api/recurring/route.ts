import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addDays, addWeeks, addMonths } from "date-fns";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

function calculateNextRun(frequency: string, cronExpr: string): Date {
  const now = new Date();

  const [hours, minutes] = cronExpr.split(":").map(Number);

  let nextRun = new Date(now);
  nextRun.setHours(hours, minutes, 0, 0);

  if (nextRun <= now) {
    switch (frequency) {
      case "daily":
        nextRun = addDays(nextRun, 1);
        break;
      case "weekly":
        nextRun = addWeeks(nextRun, 1);
        break;
      case "monthly":
        nextRun = addMonths(nextRun, 1);
        break;
    }
  }

  return nextRun;
}

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const schedules = await prisma.recurringSchedule.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(schedules);
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const { content, frequency, cronExpr, useAi, aiPrompt, aiLanguage } = body;
  const isAiMode = Boolean(useAi);
  const normalizedContent = typeof content === "string" ? content.trim() : "";
  const normalizedPrompt =
    typeof aiPrompt === "string" ? aiPrompt.trim() : undefined;
  const normalizedLanguage =
    typeof aiLanguage === "string" ? aiLanguage.trim() : undefined;

  if (!isAiMode) {
    if (!normalizedContent) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    if (normalizedContent.length > 280) {
      return NextResponse.json(
        { error: "Content exceeds 280 characters" },
        { status: 400 }
      );
    }
  } else if (normalizedPrompt && normalizedPrompt.length > 500) {
    return NextResponse.json(
      { error: "AI prompt exceeds 500 characters" },
      { status: 400 }
    );
  }

  if (!frequency || !["daily", "weekly", "monthly"].includes(frequency)) {
    return NextResponse.json(
      { error: "Invalid frequency" },
      { status: 400 }
    );
  }

  if (!cronExpr) {
    return NextResponse.json(
      { error: "Time is required" },
      { status: 400 }
    );
  }

  const nextRunAt = calculateNextRun(frequency, cronExpr);

  const schedule = await prisma.recurringSchedule.create({
    data: {
      content: isAiMode ? "" : normalizedContent,
      useAi: isAiMode,
      aiPrompt: isAiMode ? normalizedPrompt : null,
      aiLanguage: isAiMode ? normalizedLanguage : null,
      frequency,
      cronExpr,
      nextRunAt,
      isActive: true,
      userId: user.id,
    },
  });

  return NextResponse.json(schedule);
}
