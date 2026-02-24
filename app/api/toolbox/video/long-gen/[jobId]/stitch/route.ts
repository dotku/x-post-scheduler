// app/api/toolbox/video/long-gen/[jobId]/stitch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { prisma } from "@/lib/db";
import { stitchVideos } from "@/lib/video-stitch";
import { buildSignedBlobProxyUrl } from "@/lib/blob-proxy";

/**
 * POST /api/toolbox/video/long-gen/[jobId]/stitch
 * Manually trigger stitching for completed segments
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

    // Check if we have enough completed segments
    let completedUrls: string[] = [];
    try {
      completedUrls = job.completedUrls ? JSON.parse(job.completedUrls) : [];
    } catch {
      completedUrls = [];
    }

    if (completedUrls.length < 2) {
      return NextResponse.json(
        {
          error: `Not enough completed segments to stitch. Have ${completedUrls.length}, need at least 2.`,
        },
        { status: 400 },
      );
    }

    console.log(
      `[VideoJob] Manually stitching job ${jobId} (${completedUrls.length} videos)...`,
    );

    // Perform stitching - store raw blob URL in DB
    const stitchedUrl = await stitchVideos(completedUrls);

    // Update job with raw blob URL
    await prisma.videoJob.update({
      where: { id: jobId },
      data: { stitchedUrl },
    });

    // Wrap in proxy for immediate display in the response
    let responseUrl = stitchedUrl;
    if (
      stitchedUrl &&
      stitchedUrl.includes(".private.blob.vercel-storage.com")
    ) {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_LOCAL_URL ||
        process.env.APP_BASE_URL ||
        new URL(request.url).origin;
      try {
        responseUrl = buildSignedBlobProxyUrl(baseUrl, stitchedUrl);
      } catch (e) {
        console.warn("Failed to sign URL for response:", e);
      }
    }

    return NextResponse.json({
      success: true,
      stitchedUrl: responseUrl,
      message: "Videos stitched successfully!",
    });
  } catch (error) {
    console.error(`Failed to stitch job ${jobId}:`, error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Stitching failed: ${errorMsg}` },
      { status: 500 },
    );
  }
}
