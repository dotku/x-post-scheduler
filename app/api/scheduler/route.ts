import { NextRequest, NextResponse } from "next/server";
import { runScheduler } from "@/lib/scheduler";
import { detectCronTrigger, logCronRun } from "@/lib/cron-logging";

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      await logCronRun({
        jobName: "scheduler",
        endpoint: "/api/scheduler",
        method: "POST",
        success: false,
        statusCode: 401,
        durationMs: Date.now() - startedAt,
        triggeredBy: detectCronTrigger(request),
        error: "Unauthorized",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runScheduler();
  const statusCode = result.success ? 200 : 500;
  await logCronRun({
    jobName: "scheduler",
    endpoint: "/api/scheduler",
    method: "POST",
    success: result.success,
    statusCode,
    durationMs: Date.now() - startedAt,
    triggeredBy: detectCronTrigger(request),
    error: result.success ? undefined : result.error,
    metadata: result,
  });
  return NextResponse.json(result, { status: statusCode });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
