import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { prisma } from "@/lib/db";
import { buildSignedBlobProxyUrl } from "@/lib/blob-proxy";

/**
 * GET: Check job status and progress
 */
export async function GET(
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
    const job = await prisma.videoJob.findFirst({
      where: { id: jobId, userId: user.id },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Parse segments JSON
    const segments = JSON.parse(job.segments);
    const completedCount = segments.filter(
      (s: any) => s.status === "completed",
    ).length;
    const failedCount = segments.filter(
      (s: any) => s.status === "failed",
    ).length;

    let stitchedUrl = job.stitchedUrl;
    if (stitchedUrl) {
      // Extract raw blob URL in case an old job stored a proxy URL in the DB
      let rawBlobUrl = stitchedUrl;
      if (stitchedUrl.includes("/api/toolbox/blob-proxy")) {
        try {
          const inner = new URL(stitchedUrl).searchParams.get("u");
          if (inner) rawBlobUrl = inner;
        } catch {}
      }
      if (rawBlobUrl.includes(".private.blob.vercel-storage.com")) {
        try {
          const signOrigin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
          stitchedUrl = buildSignedBlobProxyUrl(signOrigin, rawBlobUrl);
        } catch (e) {
          console.warn("Failed to sign URL:", e);
        }
      }
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress: {
        total: job.segmentCount,
        completed: completedCount,
        failed: failedCount,
        pending: job.segmentCount - completedCount - failedCount,
      },
      segments,
      completedUrls: job.completedUrls ? JSON.parse(job.completedUrls) : [],
      stitchedUrl: stitchedUrl,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  } catch (error) {
    console.error("Failed to fetch job status:", error);
    return NextResponse.json(
      { error: "Failed to fetch job status" },
      { status: 500 },
    );
  }
}
