import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processAllPendingJobs } from "@/lib/video-job-processor";

/**
 * Cron endpoint to process pending video generation jobs
 * POST /api/cron/process-video-jobs
 * Called by Vercel, Cloudflare, or external scheduler
 */
export async function POST(request: NextRequest) {
  // Verify cron secret (required for security)
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processAllPendingJobs();
    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} video generation jobs`,
    });
  } catch (error) {
    console.error("Cron job processor error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
