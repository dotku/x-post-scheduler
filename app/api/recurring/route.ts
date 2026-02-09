import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addDays, addWeeks, addMonths } from "date-fns";

function calculateNextRun(frequency: string, cronExpr: string): Date {
  const now = new Date();

  // Parse time from cron expression (simple format: "HH:MM")
  const [hours, minutes] = cronExpr.split(":").map(Number);

  let nextRun = new Date(now);
  nextRun.setHours(hours, minutes, 0, 0);

  // If the time has passed today, move to next occurrence
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
  const schedules = await prisma.recurringSchedule.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(schedules);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { content, frequency, cronExpr } = body;

  if (!content || content.length === 0) {
    return NextResponse.json(
      { error: "Content is required" },
      { status: 400 }
    );
  }

  if (content.length > 280) {
    return NextResponse.json(
      { error: "Content exceeds 280 characters" },
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
      content,
      frequency,
      cronExpr,
      nextRunAt,
      isActive: true,
    },
  });

  return NextResponse.json(schedule);
}
