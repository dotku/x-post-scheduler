import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import {
  generateAndStoreMediaIndustryReport,
  type ReportPeriod,
} from "@/lib/media-news";

export const dynamic = "force-dynamic";
// Report generation can take up to 60 s (3 API calls + OpenAI)
export const maxDuration = 60;

function parsePeriod(input: string | null): ReportPeriod {
  return input === "weekly" ? "weekly" : "daily";
}

function parseDateParam(input: string | null): Date | null {
  if (!input) return null;
  const match = input.match(/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
  if (!match) return null;
  const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return isNaN(d.getTime()) ? null : d;
}

async function handle(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  const dateParam = request.nextUrl.searchParams.get("date");
  const targetDate = parseDateParam(dateParam);

  if (dateParam && !targetDate) {
    return NextResponse.json(
      { error: "Invalid date format. Use YYYY-MM-DD." },
      { status: 400 },
    );
  }

  try {
    const report = await generateAndStoreMediaIndustryReport(
      period,
      targetDate ?? undefined,
    );
    if (!report) {
      return NextResponse.json(
        { success: false, error: "No articles found. Check API keys and try again." },
        { status: 200 },
      );
    }
    revalidatePath("/zh/media-news");
    revalidatePath("/en/media-news");
    revalidatePath("/media-news");
    return NextResponse.json({
      success: true,
      period,
      date: report.date,
      sourceCount: report.sourceCount,
      usedAi: report.usedAi,
      title: period === "daily" ? report.titleZh : report.titleEn,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
