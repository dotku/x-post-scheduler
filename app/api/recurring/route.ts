import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addDays, addWeeks, addMonths } from "date-fns";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getUserXCredentials } from "@/lib/user-credentials";

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

  const [schedules, recurringUsage, dbUser] = await Promise.all([
    prisma.recurringSchedule.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.usageEvent.aggregate({
      where: {
        userId: user.id,
        source: { startsWith: "recurring_" },
      },
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
      _count: { _all: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { creditBalanceCents: true },
    }),
  ]);

  return NextResponse.json({
    balanceCents: dbUser?.creditBalanceCents ?? 0,
    usage: {
      requests: recurringUsage._count._all,
      promptTokens: recurringUsage._sum.promptTokens ?? 0,
      completionTokens: recurringUsage._sum.completionTokens ?? 0,
      totalTokens: recurringUsage._sum.totalTokens ?? 0,
    },
    schedules,
  });
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const { content, frequency, cronExpr, useAi, aiPrompt, aiLanguage, xAccountId } =
    body;
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
  const resolvedAccount = await getUserXCredentials(user.id, xAccountId);
  if (!resolvedAccount) {
    return NextResponse.json(
      { error: "Please select a valid connected X account." },
      { status: 400 }
    );
  }

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
      xAccountId: resolvedAccount.accountId,
      userId: user.id,
    },
  });

  return NextResponse.json(schedule);
}
