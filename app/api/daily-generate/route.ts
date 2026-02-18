import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { batchGenerateWithAgents } from "@/lib/agent-client";
import { detectCronTrigger, logCronRun } from "@/lib/cron-logging";

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const triggeredBy = detectCronTrigger(request);
  // Protect with CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      await logCronRun({
        jobName: "daily_generate",
        endpoint: "/api/daily-generate",
        method: "POST",
        success: false,
        statusCode: 401,
        durationMs: Date.now() - startedAt,
        triggeredBy,
        error: "Unauthorized",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Find all users with active knowledge sources and X credentials configured
    const users = await prisma.user.findMany({
      where: {
        OR: [{ xApiKey: { not: null } }, { xAccounts: { some: {} } }],
        knowledgeSources: {
          some: { isActive: true },
        },
      },
      select: { id: true },
    });

    const results: { userId: string; success: boolean; postsCreated: number }[] =
      [];

    for (const user of users) {
      // Generate 3 posts spread across the day (9 AM, 1 PM, 6 PM UTC)
      const today = new Date();
      const scheduleTimes = [9, 13, 18].map((hour) => {
        const d = new Date(today);
        d.setUTCHours(hour, 0, 0, 0);
        // If time has passed today, skip it
        if (d <= today) {
          d.setDate(d.getDate() + 1);
        }
        return d.toISOString();
      });

      const result = await batchGenerateWithAgents({
        userId: user.id,
        count: 3,
        scheduleTimes,
      });

      results.push({
        userId: user.id,
        success: result.success,
        postsCreated: result.posts_created ?? 0,
      });
    }

    const payload = {
      success: true,
      usersProcessed: results.length,
      results,
    };
    await logCronRun({
      jobName: "daily_generate",
      endpoint: "/api/daily-generate",
      method: "POST",
      success: true,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      triggeredBy,
      metadata: {
        usersProcessed: payload.usersProcessed,
        successCount: results.filter((r) => r.success).length,
        totalPostsCreated: results.reduce((sum, r) => sum + r.postsCreated, 0),
      },
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await logCronRun({
      jobName: "daily_generate",
      endpoint: "/api/daily-generate",
      method: "POST",
      success: false,
      statusCode: 500,
      durationMs: Date.now() - startedAt,
      triggeredBy,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Also support GET for Vercel cron
  return POST(request);
}
