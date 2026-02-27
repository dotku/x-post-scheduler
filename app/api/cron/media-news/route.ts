import { NextRequest, NextResponse } from "next/server";
import { detectCronTrigger, logCronRun } from "@/lib/cron-logging";
import {
  generateAndStoreMediaIndustryReport,
  type ReportPeriod,
} from "@/lib/media-news";

type TriggerPeriod = ReportPeriod | "both";

function parseMonthParam(
  input: string | null,
): { year: number; month: number } | null {
  if (!input) return null;
  const match = input.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
  };
}

function getMondaysInUtcMonth(year: number, month: number): Date[] {
  const mondays: Date[] = [];
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const firstDow = firstDay.getUTCDay();
  const offsetToMonday =
    firstDow === 0 ? 1 : firstDow <= 1 ? 1 - firstDow : 8 - firstDow;
  const current = new Date(firstDay);
  current.setUTCDate(current.getUTCDate() + offsetToMonday);

  while (current.getUTCMonth() === month - 1) {
    mondays.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 7);
  }

  return mondays;
}

function getDaysInUtcMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const current = new Date(Date.UTC(year, month - 1, 1));
  while (current.getUTCMonth() === month - 1) {
    days.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
}

function isMondayUtc(now: Date): boolean {
  return now.getUTCDay() === 1;
}

function parsePeriod(input: string | null): TriggerPeriod {
  if (input === "weekly") return "weekly";
  if (input === "both") return "both";
  return "daily";
}

async function handleRequest(request: NextRequest) {
  const startedAt = Date.now();
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      await logCronRun({
        jobName: "media-news-report",
        endpoint: "/api/cron/media-news",
        method: request.method,
        success: false,
        statusCode: 401,
        durationMs: Date.now() - startedAt,
        triggeredBy: detectCronTrigger(request),
        error: "Unauthorized",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  const monthInput = request.nextUrl.searchParams.get("month");
  const parsedMonth = parseMonthParam(monthInput);
  if (monthInput && !parsedMonth) {
    return NextResponse.json(
      { error: "Invalid month format. Use YYYY-MM." },
      { status: 400 },
    );
  }

  if (parsedMonth && period === "both") {
    return NextResponse.json(
      {
        error:
          "month parameter supports period=daily or period=weekly, not both.",
      },
      { status: 400 },
    );
  }

  const forceWeekly = request.nextUrl.searchParams.get("forceWeekly") === "1";
  const shouldRunWeekly =
    period === "weekly" || period === "both"
      ? true
      : forceWeekly || isMondayUtc(new Date());

  try {
    const results: Record<string, unknown> = {};

    if (parsedMonth && period === "daily") {
      const days = getDaysInUtcMonth(parsedMonth.year, parsedMonth.month);
      const backfillReports: unknown[] = [];
      for (const day of days) {
        const report = await generateAndStoreMediaIndustryReport("daily", day);
        if (report) {
          backfillReports.push(report);
        }
      }
      results.daily = backfillReports;
    } else if (period === "daily" || period === "both") {
      results.daily = await generateAndStoreMediaIndustryReport("daily");
    }

    if (parsedMonth) {
      const mondays = getMondaysInUtcMonth(parsedMonth.year, parsedMonth.month);
      const backfillReports: unknown[] = [];
      for (const monday of mondays) {
        const report = await generateAndStoreMediaIndustryReport(
          "weekly",
          monday,
        );
        if (report) {
          backfillReports.push(report);
        }
      }
      results.weekly = backfillReports;
    } else if (period === "weekly" || shouldRunWeekly) {
      results.weekly = await generateAndStoreMediaIndustryReport("weekly");
    }

    await logCronRun({
      jobName: "media-news-report",
      endpoint: "/api/cron/media-news",
      method: request.method,
      success: true,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      triggeredBy: detectCronTrigger(request),
      metadata: {
        period,
        month: monthInput,
        forceWeekly,
        shouldRunWeekly,
        hasDaily: Boolean(results.daily),
        hasWeekly: Boolean(results.weekly),
      },
    });

    return NextResponse.json(
      {
        success: true,
        period,
        month: monthInput,
        forceWeekly,
        shouldRunWeekly,
        dailyStored: Boolean(results.daily),
        weeklyStored: Boolean(results.weekly),
        results,
      },
      { status: 200 },
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate reports";

    await logCronRun({
      jobName: "media-news-report",
      endpoint: "/api/cron/media-news",
      method: request.method,
      success: false,
      statusCode: 500,
      durationMs: Date.now() - startedAt,
      triggeredBy: detectCronTrigger(request),
      error: errorMessage,
      metadata: { period, month: monthInput, forceWeekly },
    });

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}
