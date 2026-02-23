import { prisma } from "./db";
import { getVideoTask, submitVideoTask } from "./wavespeed";
import { deductWavespeedCredits } from "./credits";
import { trackWavespeedUsage } from "./usage-tracking";
import { put } from "@vercel/blob";
import { saveToGallery } from "./gallery";
import { buildSignedBlobProxyUrl } from "./blob-proxy";
import { stitchVideos, extractLastFrame } from "./video-stitch";
import { generateVideoPlan } from "./video-planning";

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 (Landscape)" },
  { value: "9:16", label: "9:16 (Portrait)" },
  { value: "1:1", label: "1:1 (Square)" },
];

const ASPECT_RATIOS_MAP: Record<string, string> = ASPECT_RATIOS.reduce(
  (acc: Record<string, string>, r: { value: string; label: string }) => {
    acc[r.value] = r.value;
    return acc;
  },
  {} as Record<string, string>,
);

const T2V_TO_I2V: Record<string, string> = {
  "wavespeed-ai/wan-2.2/t2v-480p-ultra-fast": "wavespeed-ai/uno",
  "wavespeed-ai/wan-2.2/t2v-720p": "wavespeed-ai/uno",
  "alibaba/wan-2.6/text-to-video": "wavespeed-ai/uno",
  "bytedance/seedance-v1.5-pro/text-to-video": "wavespeed-ai/uno",
  "kwaivgi/kling-video-o3-std/text-to-video": "wavespeed-ai/uno",
};

interface JobSegment {
  index: number;
  status: "queued" | "generating" | "completed" | "failed";
  outputUrl: string | null;
  error: string | null;
  taskId: string | null;
  prompt?: string;
}


function refreshBlobUrlIfNeeded(url: string, origin: string): string {
  // If not our blob proxy, return as is
  if (!url.includes("/api/toolbox/blob-proxy")) return url;
  
  try {
    const urlObj = new URL(url);
    const u = urlObj.searchParams.get("u");
    if (!u) return url;
    
    // Check if expired or expiring soon (within 5 mins)
    const exp = Number(urlObj.searchParams.get("exp"));
    const now = Math.floor(Date.now() / 1000);
    if (!exp || exp < now + 300) {
      console.log(`[VideoJob] Refreshing expired blob proxy URL: ${url}`);
      return buildSignedBlobProxyUrl(origin, u, 3600); // 1 hour TTL
    }
  } catch (e) {
    console.warn(`[VideoJob] Failed to parse/refresh blob URL: ${url}`, e);
  }
  
  return url;
}

export async function processVideoJob(jobId: string) {
  const job = await prisma.videoJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    console.error(`[VideoJob] Job ${jobId} not found`);
    return;
  }

  console.log(`[VideoJob] Found job ${jobId}, current status: ${job.status}`);

  if (job.status !== "pending") {
    console.log(`[VideoJob] Job ${jobId} already being processed or completed`);
    return;
  }

  try {
    // Mark as processing
    await prisma.videoJob.update({
      where: { id: jobId },
      data: {
        status: "processing",
        startedAt: new Date(),
      },
    });

    console.log(
      `[VideoJob] Processing job ${jobId} with ${job.segmentCount} segments`,
    );
    console.log(`[VideoJob] Model: ${job.modelId}`);
    console.log(`[VideoJob] Prompt: ${job.prompt.substring(0, 50)}...`);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "https://x-post-scheduler.jytech.us";

    // Refresh i2vImageUrl if needed
    if (job.i2vImageUrl) {
      const refreshedUrl = refreshBlobUrlIfNeeded(job.i2vImageUrl, baseUrl);
      if (refreshedUrl !== job.i2vImageUrl) {
        job.i2vImageUrl = refreshedUrl;
        // Optionally update DB
        await prisma.videoJob.update({
          where: { id: jobId },
          data: { i2vImageUrl: refreshedUrl }
        });
      }
    }

    let segments: JobSegment[] = JSON.parse(job.segments);

    // Generate per-segment prompts if missing (Storyboarding)
    if (segments.some((s) => !s.prompt)) {
      console.log(
        `[VideoJob] Generating storyline plan for ${job.segmentCount} segments...`,
      );
      try {
        const plan = await generateVideoPlan(job.prompt, job.segmentCount);
        if (plan.prompts && plan.prompts.length > 0) {
          segments = segments.map((s, i) => ({
            ...s,
            prompt: plan.prompts[i] || job.prompt, // Fallback to main prompt
          }));

          // Save plan to DB immediately
          await prisma.videoJob.update({
            where: { id: jobId },
            data: { segments: JSON.stringify(segments) },
          });
          console.log(`[VideoJob] Storyline plan saved.`);
        }
      } catch (err) {
        console.error(`[VideoJob] Failed to generate plan:`, err);
        // Continue without specific prompts (will use job.prompt as fallback logic below)
      }
    }

    const completedUrls: string[] = [];
    let prevFrameUrl: string | null = job.i2vImageUrl ?? null;
    const i2vContinuityModelId = T2V_TO_I2V[job.modelId] ?? null;

    // Process each segment
    for (const segment of segments) {
      // Skip if already completed (e.g., during retry)
      if (segment.status === "completed") {
        if (segment.outputUrl) completedUrls.push(segment.outputUrl);
        continue;
      }

      try {
        // Update segment status
        const updatedSegments = segments.map((s) =>
          s.index === segment.index
            ? { ...s, status: "generating" as const }
            : s,
        );
        segments = updatedSegments;
        await prisma.videoJob.update({
          where: { id: jobId },
          data: {
            segments: JSON.stringify(updatedSegments),
          },
        });

        // Determine model and image for this segment
        const isFirstSeg = segment.index === 1;
        const segModelId =
          !isFirstSeg && prevFrameUrl && i2vContinuityModelId
            ? i2vContinuityModelId
            : job.modelId;
        const segImageUrl =
          !isFirstSeg && prevFrameUrl
            ? prevFrameUrl
            : (job.i2vImageUrl ?? undefined);

        // Submit segment generation
        const taskRes = await submitVideoTask({
          modelId: segModelId,
          prompt: segment.prompt || job.prompt,
          duration: job.duration,
          aspectRatio: job.aspectRatio || "16:9",
          ...(segImageUrl ? { imageUrl: segImageUrl } : {}),
          generateAudio: job.generateAudio,
        });

        // Poll for completion
        let task = taskRes;
        const maxAttempts = 300; // 15 minutes max
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (task.status === "completed" && task.outputs?.[0]) {
            const outputUrl = task.outputs[0];
            completedUrls.push(outputUrl);

            // Update segment
            const newSegments = segments.map((s) =>
              s.index === segment.index
                ? {
                    ...s,
                    status: "completed" as const,
                    outputUrl,
                    taskId: task.id,
                  }
                : s,
            );
            segments = newSegments;
            await prisma.videoJob.update({
              where: { id: jobId },
              data: {
                segments: JSON.stringify(newSegments),
              },
            });

            // Deduct credits
            await deductWavespeedCredits({
              userId: job.userId,
              modelId: job.modelId,
              mediaType: "video",
              source: "long_video_background",
              taskId: task.id,
            });

            // Track usage
            await trackWavespeedUsage({
              userId: job.userId,
              source: "long_video_background",
              model: job.modelId,
              prompt: job.prompt,
            });

            // Extract last frame for I2V continuity between segments
            if (segment.index < job.segmentCount && i2vContinuityModelId) {
              try {
                console.log(`[VideoJob] Extracting last frame from segment ${segment.index} for I2V continuity...`);
                const frameBuffer = await extractLastFrame(outputUrl);
                const framePut = await put(
                  `frames/continuity-${Date.now()}-${segment.index}.jpg`,
                  frameBuffer,
                  { access: "public", contentType: "image/jpeg", addRandomSuffix: false },
                );
                prevFrameUrl = framePut.url;
                console.log(`[VideoJob] Continuity frame: ${prevFrameUrl}`);
              } catch (frameErr) {
                console.warn(`[VideoJob] Failed to extract last frame, continuity skipped:`, frameErr);
                prevFrameUrl = null;
              }
            }

            break;
          }

          if (task.status === "failed") {
            throw new Error(task.error || "Generation failed");
          }

          // Poll again in 3 seconds
          await new Promise((resolve) => setTimeout(resolve, 3000));
          task = await getVideoTask(task.urls?.get || task.id);
        }

        if (task.status !== "completed") {
          throw new Error("Generation timeout");
        }
      } catch (segErr) {
        const segError =
          segErr instanceof Error
            ? segErr.message
            : `Segment ${segment.index} failed`;

        console.error(`[VideoJob] Segment ${segment.index} failed:`, segError);
        console.error(`[VideoJob] Job: ${jobId}, Model: ${job.modelId}`);

        const updatedSegments = segments.map((s) =>
          s.index === segment.index
            ? { ...s, status: "failed" as const, error: segError }
            : s,
        );
        segments = updatedSegments;
        await prisma.videoJob.update({
          where: { id: jobId },
          data: {
            segments: JSON.stringify(updatedSegments),
          },
        });
      }
    }

    // Auto-stitch if we have at least 2 completed segments
    let stitchedUrl: string | null = null;
    if (completedUrls.length >= 2) {
      try {
        console.log(`[VideoJob] Stitching ${completedUrls.length} videos...`);
        stitchedUrl = await stitchVideos(completedUrls);
        // Store the raw blob URL in DB; proxy wrapping is applied at read time by the API routes
      } catch (e) {
        console.error("[VideoJob] Stitching failed:", e);
      }
    }

    // Update job status based on results
    const finalSegments = segments; // Get latest segments from loop
    const failedCount = finalSegments.filter(
      (s) => s.status === "failed",
    ).length;
    const completedCount = finalSegments.filter(
      (s) => s.status === "completed",
    ).length;

    // Determine final status - be forgiving, stitch what we have
    // Only fail if we got nothing, otherwise mark as completed with whatever segments we have
    let finalStatus: "completed" | "failed" | "partial" = "failed";
    let completionNote = "";

    if (completedCount === job.segmentCount) {
      // Perfect - all segments completed
      finalStatus = "completed";
      completionNote = "All segments completed successfully";
    } else if (completedCount >= Math.ceil(job.segmentCount * 0.5)) {
      // Good enough - more than 50% completed, stitch what we have
      finalStatus = "completed";
      completionNote = `Partial completion: ${completedCount}/${job.segmentCount} segments (${failedCount} failed). Stitched available segments.`;
    } else if (completedCount > 0) {
      // Some segments completed but less than 50%, mark as partial
      finalStatus = "partial";
      completionNote = `Limited completion: only ${completedCount}/${job.segmentCount} segments (${failedCount} failed). ${job.segmentCount - completedCount} segments still pending/failed.`;
    }
    // else: No segments completed, keep as "failed"

    // Update job with final status
    await prisma.videoJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        completedUrls: JSON.stringify(completedUrls),
        stitchedUrl,
        completedAt:
          finalStatus === "completed" || finalStatus === "partial"
            ? new Date()
            : null,
        error:
          finalStatus !== "completed" && completionNote ? completionNote : null,
      },
    });

    // Auto-save first completed segment to gallery
    if (completedUrls.length > 0) {
      try {
        await saveToGallery({
          userId: job.userId,
          type: "video",
          modelId: job.modelId,
          modelLabel: `${job.modelLabel} (long-video segment)`,
          prompt: job.prompt,
          sourceUrl: completedUrls[0],
          aspectRatio: job.aspectRatio || "16:9",
          generationMeta: {
            provider: "wavespeed",
            kind: "video",
            mode: job.videoMode,
            longVideo: true,
            segmentCount: job.segmentCount,
            completedSegments: completedUrls.length,
            duration: job.duration,
            generateAudio: job.generateAudio,
          },
        });
      } catch (galleryErr) {
        console.warn(
          `Failed to save segment to gallery for job ${jobId}:`,
          galleryErr,
        );
        // Don't fail the job just because gallery save failed
      }
    }

    console.log(
      `Job ${jobId} completed with ${completedUrls.length}/${job.segmentCount} videos (status: ${finalStatus})`,
    );
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    await prisma.videoJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

/**
 * Process all pending video jobs
 * Call this from a cron endpoint or scheduler
 */
export async function processAllPendingJobs() {
  const pendingJobs = await prisma.videoJob.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 5, // Process max 5 at a time
  });

  console.log(`Processing ${pendingJobs.length} pending video jobs in parallel`);

  // Different jobs have no inter-dependencies, run them concurrently.
  // Segments within each job still run sequentially (I2V frame continuity).
  await Promise.all(pendingJobs.map((job: { id: string }) => processVideoJob(job.id)));

  return { processed: pendingJobs.length };
}
