import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addDays, addWeeks, addMonths, addHours } from "date-fns";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getUserXCredentials } from "@/lib/user-credentials";
import { IMAGE_MODELS } from "@/lib/wavespeed";
import { decodeRecurringAiPrompt, encodeRecurringAiPrompt } from "@/lib/recurring-ai";
import { isTierAtLeast, HOURLY_FREQUENCIES } from "@/lib/subscription";

const ALL_FREQUENCIES = ["daily", "weekly", "monthly", ...Object.keys(HOURLY_FREQUENCIES)];

function calculateNextRun(frequency: string, cronExpr: string): Date {
  const now = new Date();

  // Hourly interval frequencies — start N hours from now
  if (frequency in HOURLY_FREQUENCIES) {
    return addHours(now, HOURLY_FREQUENCIES[frequency].hours);
  }

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

  const normalizedSchedules = schedules.map((schedule) => {
    const decoded = decodeRecurringAiPrompt(schedule.aiPrompt);
    return {
      ...schedule,
      aiPrompt: decoded.prompt,
      imageModelId: decoded.imageModelId,
      trendRegion: schedule.trendRegion ?? null,
    };
  });

  return NextResponse.json({
    balanceCents: dbUser?.creditBalanceCents ?? 0,
    usage: {
      requests: recurringUsage._count._all,
      promptTokens: recurringUsage._sum.promptTokens ?? 0,
      completionTokens: recurringUsage._sum.completionTokens ?? 0,
      totalTokens: recurringUsage._sum.totalTokens ?? 0,
    },
    schedules: normalizedSchedules,
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
  const {
    content,
    frequency,
    cronExpr,
    useAi,
    aiPrompt,
    aiLanguage,
    xAccountId,
    imageModelId,
    trendRegion,
  } =
    body;
  const isAiMode = Boolean(useAi);
  const normalizedContent = typeof content === "string" ? content.trim() : "";
  const normalizedPrompt =
    typeof aiPrompt === "string" ? aiPrompt.trim() : undefined;
  const normalizedLanguage =
    typeof aiLanguage === "string" ? aiLanguage.trim() : undefined;
  const normalizedImageModelId =
    typeof imageModelId === "string" ? imageModelId.trim() : undefined;
  const validTrendRegions = ["global", "usa", "china", "africa"];
  const normalizedTrendRegion =
    typeof trendRegion === "string" && validTrendRegions.includes(trendRegion)
      ? trendRegion
      : null;

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

  if (normalizedImageModelId) {
    const validModel = IMAGE_MODELS.find((model) => model.id === normalizedImageModelId);
    if (!validModel) {
      return NextResponse.json(
        { error: "Invalid image model selection" },
        { status: 400 }
      );
    }
  }

  if (!frequency || !ALL_FREQUENCIES.includes(frequency)) {
    return NextResponse.json(
      { error: "Invalid frequency" },
      { status: 400 }
    );
  }

  if (!(frequency in HOURLY_FREQUENCIES) && !cronExpr) {
    return NextResponse.json(
      { error: "Time is required" },
      { status: 400 }
    );
  }

  // Check tier requirements for trendRegion and hourly frequencies
  const needsTierCheck = normalizedTrendRegion || frequency in HOURLY_FREQUENCIES;
  if (needsTierCheck) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { subscriptionTier: true, subscriptionStatus: true },
    });
    const isActive = dbUser?.subscriptionStatus === "active";

    // trendRegion 功能仅限白银及以上会员
    if (normalizedTrendRegion && (!isTierAtLeast(dbUser?.subscriptionTier, "silver") || !isActive)) {
      return NextResponse.json(
        { error: "TIER_REQUIRED", minTier: "silver" },
        { status: 403 },
      );
    }

    // Hourly frequency tier check
    if (frequency in HOURLY_FREQUENCIES) {
      const required = HOURLY_FREQUENCIES[frequency].minTier;
      if (!isTierAtLeast(dbUser?.subscriptionTier, required) || !isActive) {
        return NextResponse.json(
          { error: "TIER_REQUIRED", minTier: required },
          { status: 403 },
        );
      }
    }
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
      aiPrompt: isAiMode
        ? encodeRecurringAiPrompt({
            prompt: normalizedPrompt,
            imageModelId: normalizedImageModelId,
          })
        : null,
      aiLanguage: isAiMode ? normalizedLanguage : null,
      trendRegion: isAiMode ? normalizedTrendRegion : null,
      frequency,
      cronExpr,
      nextRunAt,
      isActive: true,
      xAccountId: resolvedAccount.accountId,
      userId: user.id,
    },
  });

  const decoded = decodeRecurringAiPrompt(schedule.aiPrompt);
  return NextResponse.json({
    ...schedule,
    aiPrompt: decoded.prompt,
    imageModelId: decoded.imageModelId,
  });
}
