import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { processAllPendingJobs } from "@/lib/video-job-processor";

/**
 * POST /api/toolbox/video/long-gen/process-now
 * Manually trigger video job processing (for testing/immediate processing)
 * Only available to authenticated users
 */
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  // Rate limit: max 1 request per 10 seconds per user
  const cacheKey = `process-jobs-${user.id}`;
  const lastProcessed = (global as any)[cacheKey];
  if (lastProcessed && Date.now() - lastProcessed < 10000) {
    return NextResponse.json(
      {
        error:
          "Processing already triggered recently. Please wait a few seconds.",
      },
      { status: 429 },
    );
  }

  try {
    (global as any)[cacheKey] = Date.now();
    const result = await processAllPendingJobs();
    console.log(
      `[Manual] ${user.id} triggered job processing: ${result.processed} jobs processed`,
    );

    return NextResponse.json({
      success: true,
      processed: result.processed,
      message: `Processed ${result.processed} video generation job(s)`,
    });
  } catch (error) {
    console.error("Failed to process jobs:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process jobs",
      },
      { status: 500 },
    );
  }
}
