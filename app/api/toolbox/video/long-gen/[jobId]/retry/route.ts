import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { prisma } from "@/lib/db";
import { processVideoJob } from "@/lib/video-job-processor";

/**
 * POST /api/toolbox/video/long-gen/[jobId]/retry
 * Retry any video job by resetting it to pending status
 * Can retry completed, failed, or partial jobs
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { jobId } = await params;

  try {
    // Verify job exists and belongs to user
    const job = await prisma.videoJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Don't allow retry if already pending or processing
    if (job.status === "pending" || job.status === "processing") {
      return NextResponse.json(
        {
          error: `Cannot retry job with status: ${job.status}. It will be processed automatically.`,
        },
        { status: 400 },
      );
    }

    // Reset job to pending (clear results from previous run)
    const updated = await prisma.videoJob.update({
      where: { id: jobId },
      data: {
        status: "pending",
        startedAt: null,
        completedAt: null,
        error: null,
        completedUrls: JSON.stringify([]),
        stitchedUrl: null,
        segments: JSON.stringify(
          // Reset segments to queued status
          JSON.parse(job.segments).map((seg: any) => ({
            ...seg,
            status: "queued",
            outputUrl: null,
            error: null,
            taskId: null,
          })),
        ),
      },
    });

    // Immediately process the job
    console.log(`Retrying job ${jobId} - starting processing immediately`);
    try {
      await processVideoJob(jobId);
    } catch (processError) {
      const processErrorMsg =
        processError instanceof Error
          ? processError.message
          : JSON.stringify(processError);
      console.error(`Failed during job processing ${jobId}:`, processErrorMsg);
      return NextResponse.json(
        {
          error: `Processing failed: ${processErrorMsg}`,
          reason:
            "Job was reset but processing encountered an error. Please try again later.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Job retry started! Processing segments now...",
      job: updated,
    });
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`Failed to retry job ${jobId}:`, errorMsg);
    console.error("Full error:", error);
    return NextResponse.json(
      {
        error: `Failed to retry job: ${errorMsg}`,
        reason: "Unable to reset job. Please verify it exists and try again.",
      },
      { status: 500 },
    );
  }
}
