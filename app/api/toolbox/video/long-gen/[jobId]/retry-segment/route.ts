import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { prisma } from "@/lib/db";
import { processVideoJob } from "@/lib/video-job-processor";

/**
 * POST /api/toolbox/video/long-gen/[jobId]/retry-segment
 * Reset a single stuck segment back to queued and re-process the job.
 * Body: { segmentIndex: number }
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

  let segmentIndex: number;
  try {
    const body = await request.json();
    segmentIndex = Number(body.segmentIndex);
    if (!Number.isInteger(segmentIndex) || segmentIndex < 1) {
      return NextResponse.json({ error: "Invalid segmentIndex" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const job = await prisma.videoJob.findUnique({ where: { id: jobId } });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (job.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const segments = JSON.parse(job.segments) as any[];
    const seg = segments.find((s) => s.index === segmentIndex);

    if (!seg) {
      return NextResponse.json(
        { error: `Segment ${segmentIndex} not found` },
        { status: 404 },
      );
    }

    if (seg.status === "completed") {
      return NextResponse.json(
        { error: `Segment ${segmentIndex} is already completed` },
        { status: 400 },
      );
    }

    // Reset only the target segment to queued
    const updatedSegments = segments.map((s) =>
      s.index === segmentIndex
        ? { ...s, status: "queued", outputUrl: null, error: null, taskId: null }
        : s,
    );

    // Also reset job status to pending so processVideoJob will pick it up
    await prisma.videoJob.update({
      where: { id: jobId },
      data: {
        status: "pending",
        error: null,
        segments: JSON.stringify(updatedSegments),
      },
    });

    console.log(`[RetrySegment] Retrying segment ${segmentIndex} of job ${jobId}`);

    try {
      await processVideoJob(jobId);
    } catch (processError) {
      const msg = processError instanceof Error ? processError.message : String(processError);
      console.error(`[RetrySegment] Processing failed for job ${jobId}:`, msg);
      return NextResponse.json(
        { error: `Segment reset but processing failed: ${msg}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Segment ${segmentIndex} retried successfully`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[RetrySegment] Error:`, msg);
    return NextResponse.json({ error: `Failed: ${msg}` }, { status: 500 });
  }
}
