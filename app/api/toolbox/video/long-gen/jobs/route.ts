import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { prisma } from "@/lib/db";
import { buildSignedBlobProxyUrl } from "@/lib/blob-proxy";

/**
 * GET /api/toolbox/video/long-gen/jobs
 * Get all video generation jobs for current user with pagination
 */
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100);
  const offset = Number(url.searchParams.get("offset")) || 0;
  const status = url.searchParams.get("status") || undefined; // "pending", "processing", "completed", "failed"

  try {
    const whereClause = { userId: user.id } as any;
    if (status) {
      whereClause.status = status;
    }

    const [jobs, total] = await Promise.all([
      prisma.videoJob.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.videoJob.count({ where: whereClause }),
    ]);

    // Use local app URL for signed URLs (accessible from browser)
    const signOrigin =
      process.env.NEXT_PUBLIC_APP_LOCAL_URL ||
      process.env.APP_BASE_URL ||
      url.origin;

    const enrichedJobs = jobs.map((job) => {
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
            stitchedUrl = buildSignedBlobProxyUrl(signOrigin, rawBlobUrl);
          } catch (e) {
            console.warn("Failed to sign URL:", e);
          }
        }
      }

      return {
        ...job,
        segments: JSON.parse(job.segments),
        completedUrls: job.completedUrls ? JSON.parse(job.completedUrls) : [],
        stitchedUrl,
      };
    });

    return NextResponse.json({
      jobs: enrichedJobs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Failed to fetch video jobs:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch jobs",
      },
      { status: 500 },
    );
  }
}
