import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { downloadVideo, resolveVideoUrls } from "@/lib/weixin-worker-client";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

// Video resolution + downloads can take several minutes
export const maxDuration = 300;

const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB Vercel Blob limit

function getExtFromContentType(ct: string): string {
  if (ct.includes("mp4")) return "mp4";
  if (ct.includes("webm")) return "webm";
  if (ct.includes("quicktime")) return "mov";
  return "mp4";
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "item";
}

interface VideoDownloadItem {
  sourceUrl?: string;
  objectId?: string;
  title?: string;
  duration?: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;
  const body = await request.json();
  const { videoUrls } = body as { videoUrls: VideoDownloadItem[] };

  if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
    return NextResponse.json({ error: "videoUrls array is required" }, { status: 400 });
  }

  const source = await prisma.knowledgeSource.findFirst({
    where: { id, userId: user.id, type: "weixin_channel" },
  });

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  if (!user.weixinCookie) {
    return NextResponse.json({ error: "WeChat not connected" }, { status: 400 });
  }

  const cookies = JSON.parse(user.weixinCookie);

  // Step 1: Resolve video URLs for items that don't have a direct sourceUrl
  const needsResolution = videoUrls.filter((v) => !v.sourceUrl && (v.objectId || v.title));
  const alreadyResolved = videoUrls.filter((v) => v.sourceUrl);

  let resolvedVideos: VideoDownloadItem[] = [...alreadyResolved];

  if (needsResolution.length > 0) {
    console.log(`[download-videos] Resolving ${needsResolution.length} video URLs via worker...`);
    try {
      const resolveResult = await resolveVideoUrls(
        cookies,
        needsResolution.map((v) => ({ objectId: v.objectId, title: v.title || "" })),
        user.id
      );

      for (const resolved of resolveResult.results) {
        if (resolved.videoUrl) {
          // Find the matching input item to carry over duration etc
          const original = needsResolution.find(
            (v) => v.objectId === resolved.objectId || v.title === resolved.title
          );
          resolvedVideos.push({
            sourceUrl: resolved.videoUrl,
            objectId: resolved.objectId,
            title: resolved.title || original?.title,
            duration: original?.duration,
          });
        } else {
          console.log(`[download-videos] Could not resolve URL for: ${resolved.title} — ${resolved.error}`);
        }
      }
    } catch (error) {
      console.error("[download-videos] URL resolution failed:", error);
      // Continue with whatever we have
    }
  }

  if (resolvedVideos.length === 0) {
    return NextResponse.json({
      error: "No video URLs could be resolved. Try refreshing the data source.",
      results: [],
      downloaded: 0,
      total: videoUrls.length,
    });
  }

  // Step 2: Download videos one at a time
  const results: Array<{
    sourceUrl: string;
    success: boolean;
    blobUrl?: string;
    error?: string;
  }> = [];

  for (const video of resolvedVideos) {
    if (!video.sourceUrl) continue;

    try {
      console.log(`[download-videos] Downloading: ${video.title || video.sourceUrl}`);
      const downloadResult = await downloadVideo(cookies, video.sourceUrl, undefined, user.id);

      if (!downloadResult.success || !downloadResult.data) {
        results.push({
          sourceUrl: video.sourceUrl,
          success: false,
          error: downloadResult.error || "Download failed",
        });
        continue;
      }

      const buffer = Buffer.from(downloadResult.data, "base64");
      if (buffer.length > MAX_VIDEO_BYTES) {
        results.push({
          sourceUrl: video.sourceUrl,
          success: false,
          error: `Video too large (${Math.round(buffer.length / 1024 / 1024)}MB, max 200MB)`,
        });
        continue;
      }

      const mimeType = downloadResult.contentType || "video/mp4";
      const ext = getExtFromContentType(mimeType);
      const blobPath = `knowledge/${safeSegment(user.id)}/${safeSegment(id)}/${Date.now()}-video.${ext}`;

      const uploaded = await put(blobPath, buffer, {
        access: "public",
        addRandomSuffix: true,
        contentType: mimeType,
      });

      // Find matching thumbnail for this video
      const thumbnail = await prisma.knowledgeImage.findFirst({
        where: {
          knowledgeSourceId: id,
          mediaType: "thumbnail",
          altText: video.title || undefined,
        },
      });

      await prisma.knowledgeImage.upsert({
        where: {
          knowledgeSourceId_sourceUrl: {
            knowledgeSourceId: id,
            sourceUrl: video.sourceUrl,
          },
        },
        update: {
          blobUrl: uploaded.url,
          mimeType,
          mediaType: "video",
          duration: video.duration ?? null,
          thumbnailBlobUrl: thumbnail?.blobUrl ?? null,
        },
        create: {
          userId: user.id,
          knowledgeSourceId: id,
          sourceUrl: video.sourceUrl,
          blobUrl: uploaded.url,
          mimeType,
          altText: video.title ?? null,
          mediaType: "video",
          duration: video.duration ?? null,
          thumbnailBlobUrl: thumbnail?.blobUrl ?? null,
        },
      });

      console.log(`[download-videos] Stored: ${video.title} (${Math.round(buffer.length / 1024)}KB)`);
      results.push({ sourceUrl: video.sourceUrl, success: true, blobUrl: uploaded.url });
    } catch (error) {
      console.error(`[download-videos] Error downloading ${video.sourceUrl}:`, error);
      results.push({
        sourceUrl: video.sourceUrl,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  return NextResponse.json({ results, downloaded: succeeded, total: videoUrls.length });
}
