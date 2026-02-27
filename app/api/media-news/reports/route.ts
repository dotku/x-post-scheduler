import { NextRequest, NextResponse } from "next/server";
import {
  listStoredMediaIndustryReports,
  type ReportPeriod,
} from "@/lib/media-news";

function parsePeriod(input: string | null): ReportPeriod {
  return input === "weekly" ? "weekly" : "daily";
}

function parseLimit(input: string | null): number {
  const parsed = Number(input ?? "20");
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(Math.max(Math.floor(parsed), 1), 100);
}

function parseDate(input: string | null): Date | null {
  if (!input) return null;
  const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(input);
  if (!isIsoDate) return null;
  const parsed = new Date(`${input}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(request: NextRequest) {
  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

  const fromInput = request.nextUrl.searchParams.get("from");
  const toInput = request.nextUrl.searchParams.get("to");
  const fromDate = parseDate(fromInput);
  const toDate = parseDate(toInput);

  if (fromInput && !fromDate) {
    return NextResponse.json(
      { success: false, error: "Invalid from date. Use YYYY-MM-DD." },
      { status: 400 },
    );
  }

  if (toInput && !toDate) {
    return NextResponse.json(
      { success: false, error: "Invalid to date. Use YYYY-MM-DD." },
      { status: 400 },
    );
  }

  const reports = await listStoredMediaIndustryReports(period, 100);
  const filtered = reports.filter((report) => {
    const date = new Date(`${report.date}T00:00:00.000Z`);
    if (fromDate && date < fromDate) return false;
    if (toDate && date > toDate) return false;
    return true;
  });

  const items = filtered.slice(0, limit).map((report) => ({
    period: report.period,
    date: report.date,
    titleEn: report.titleEn,
    titleZh: report.titleZh,
    summaryEn: report.summaryEn,
    summaryZh: report.summaryZh,
    sourceCount: report.sourceCount,
    generatedAt: report.generatedAt,
    usedAi: report.usedAi,
  }));

  return NextResponse.json({
    success: true,
    period,
    count: items.length,
    items,
  });
}
