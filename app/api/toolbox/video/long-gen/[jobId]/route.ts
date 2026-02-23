import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { prisma } from "@/lib/db";
import { buildSignedBlobProxyUrl } from "@/lib/blob-proxy";

/**
 * PATCH: Update job prompt and/or per-segment prompts
 * Body: { prompt?: string; segmentPrompts?: Record<number, string> }
 */
export async function PATCH(
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

  let body: { prompt?: string; segmentPrompts?: Record<number, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.prompt && !body.segmentPrompts) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const job = await prisma.videoJob.findUnique({ where: { id: jobId } });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (job.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updateData: { prompt?: string; segments?: string } = {};

    if (body.prompt !== undefined) {
      updateData.prompt = body.prompt.trim();
    }

    if (body.segmentPrompts && Object.keys(body.segmentPrompts).length > 0) {
      const segments = JSON.parse(job.segments) as Array<{ index: number; prompt?: string; [key: string]: unknown }>;
      const updated = segments.map((s) => {
        const newPrompt = body.segmentPrompts![s.index];
        return newPrompt !== undefined ? { ...s, prompt: newPrompt.trim() } : s;
      });
      updateData.segments = JSON.stringify(updated);
    }

    await prisma.videoJob.update({ where: { id: jobId }, data: updateData });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[JobPatch] Error:`, msg);
    return NextResponse.json({ error: `Failed: ${msg}` }, { status: 500 });
  }
}

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
