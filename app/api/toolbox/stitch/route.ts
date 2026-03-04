import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getCreditBalance, deductFlatFee } from "@/lib/credits";
import { prisma } from "@/lib/db";
import { stitchVideosWithTrim, type StitchClipInput } from "@/lib/video-stitch";
import { buildSignedBlobProxyUrl } from "@/lib/blob-proxy";

const STITCH_BASE_FEE_CENTS = 10;
const STITCH_PER_CLIP_FEE_CENTS = 5;

function getStitchFeeCents(clipCount: number): number {
  return STITCH_BASE_FEE_CENTS + STITCH_PER_CLIP_FEE_CENTS * clipCount;
}

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

interface StitchRequestClip {
  url: string;
  trimStart?: number;
  trimEnd?: number;
}

export const maxDuration = 300; // 5 minutes for ffmpeg processing

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const {
    clips,
    crossfadeDuration = 0.5,
    bgm,
  } = body as {
    clips: StitchRequestClip[];
    crossfadeDuration?: number;
    bgm?: { url: string; volume: number };
  };

  // Validate clips
  if (!Array.isArray(clips) || clips.length < 2) {
    return NextResponse.json({ error: "At least 2 clips are required" }, { status: 400 });
  }
  if (clips.length > 20) {
    return NextResponse.json({ error: "Maximum 20 clips allowed" }, { status: 400 });
  }
  for (let i = 0; i < clips.length; i++) {
    if (!clips[i].url || !isValidUrl(clips[i].url)) {
      return NextResponse.json({ error: `Invalid URL for clip ${i + 1}` }, { status: 400 });
    }
    if (clips[i].trimStart != null && clips[i].trimStart! < 0) {
      return NextResponse.json({ error: `Invalid trimStart for clip ${i + 1}` }, { status: 400 });
    }
    if (clips[i].trimEnd != null && clips[i].trimEnd! <= (clips[i].trimStart ?? 0)) {
      return NextResponse.json({ error: `trimEnd must be > trimStart for clip ${i + 1}` }, { status: 400 });
    }
  }

  // Validate crossfade
  const xfade = Math.max(0, Math.min(2, Number(crossfadeDuration) || 0.5));

  // Validate BGM
  if (bgm) {
    if (!bgm.url || !isValidUrl(bgm.url)) {
      return NextResponse.json({ error: "Invalid BGM URL" }, { status: 400 });
    }
    bgm.volume = Math.max(0, Math.min(100, Number(bgm.volume) || 50));
  }

  // Credit check
  const feeCents = getStitchFeeCents(clips.length);
  const balance = await getCreditBalance(user.id);
  if (balance < feeCents) {
    return NextResponse.json(
      {
        error: `INSUFFICIENT_CREDITS. Need $${(feeCents / 100).toFixed(2)} but balance is $${(balance / 100).toFixed(2)}.`,
      },
      { status: 402 },
    );
  }

  // Deduct credits upfront
  try {
    await deductFlatFee({ userId: user.id, feeCents, source: "toolbox_stitch" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Credit deduction failed" },
      { status: 402 },
    );
  }

  // Create job record
  const job = await prisma.stitchJob.create({
    data: {
      userId: user.id,
      config: JSON.stringify({ clips, crossfadeDuration: xfade, bgm }),
      clipCount: clips.length,
      status: "processing",
      costCents: feeCents,
    },
  });

  // Run stitch in background after response is sent
  after(async () => {
    try {
      console.log(`[StitchAPI] Starting stitch job ${job.id} with ${clips.length} clips`);
      const stitchClips: StitchClipInput[] = clips.map((c) => ({
        url: c.url,
        trimStart: c.trimStart,
        trimEnd: c.trimEnd,
      }));

      const resultUrl = await stitchVideosWithTrim({
        clips: stitchClips,
        crossfadeDuration: xfade,
        bgm: bgm ? { url: bgm.url, volume: bgm.volume } : undefined,
      });

      await prisma.stitchJob.update({
        where: { id: job.id },
        data: { status: "completed", resultUrl, completedAt: new Date() },
      });
      console.log(`[StitchAPI] Job ${job.id} completed: ${resultUrl}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stitch failed";
      console.error(`[StitchAPI] Job ${job.id} failed:`, msg);
      await prisma.stitchJob.update({
        where: { id: job.id },
        data: { status: "failed", error: msg },
      });
    }
  });

  return NextResponse.json({ jobId: job.id, costCents: feeCents }, { status: 201 });
}

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const job = await prisma.stitchJob.findUnique({ where: { id: jobId } });
  if (!job || job.userId !== user.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Wrap private blob URLs in signed proxy
  let resultUrl = job.resultUrl;
  if (resultUrl && resultUrl.includes("blob.vercel-storage.com") && !resultUrl.includes("public")) {
    const origin =
      process.env.NEXT_PUBLIC_APP_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_APP_LOCAL_URL ||
      "https://xpilot.jytech.us";
    resultUrl = buildSignedBlobProxyUrl(origin, resultUrl, 3600);
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    resultUrl: job.status === "completed" ? resultUrl : undefined,
    error: job.status === "failed" ? job.error : undefined,
    costCents: job.costCents,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  });
}
