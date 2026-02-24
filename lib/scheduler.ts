import { prisma } from "./db";
import { postTweet, postTweetWithMedia } from "./x-client";
import { getUserXCredentials } from "./user-credentials";
import { generateTweet } from "./openai";
import { trackTokenUsage, trackWavespeedUsage } from "./usage-tracking";
import {
  hasCredits,
  deductCredits,
  deductWavespeedCredits,
  getCreditBalance,
  getWavespeedFeeCents,
} from "./credits";
import { addDays, addWeeks, addMonths, addHours } from "date-fns";
import { HOURLY_FREQUENCIES } from "./subscription";
import { decodeRecurringAiPrompt } from "./recurring-ai";
import { submitImageTask, getVideoTask } from "./wavespeed";
import { buildTrendPrompt } from "./trending";

async function fetchBinary(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch generated image (${response.status})`);
  }
  const mimeType = (response.headers.get("content-type") || "image/jpeg")
    .split(";")[0]
    .trim();
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType,
  };
}

export async function waitForImageOutput(taskIdOrUrl: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const task = await getVideoTask(taskIdOrUrl);
    if (task.status === "completed" && task.outputs?.[0]) {
      return { outputUrl: task.outputs[0], taskId: task.id };
    }
    if (task.status === "failed") {
      throw new Error(task.error || "Image generation failed");
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Image generation timed out");
}

export async function processScheduledPosts() {
  const now = new Date();

  const duePosts = await prisma.post.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { lte: now },
      userId: { not: null },
    },
  });

  console.log(`Found ${duePosts.length} posts to process`);

  for (const post of duePosts) {
    console.log(`Processing post ${post.id}: ${post.content.substring(0, 50)}...`);

    const resolved = await getUserXCredentials(post.userId!, post.xAccountId);
    if (!resolved) {
      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: "failed",
          error: "X API credentials not configured",
        },
      });
      console.log(`Post ${post.id} failed: no credentials`);
      continue;
    }

    let result;

    // Check for attached media
    if (post.mediaAssetId) {
      const media = await prisma.mediaAsset.findUnique({
        where: { id: post.mediaAssetId },
      });
      if (media?.data) {
        result = await postTweetWithMedia(
          post.content,
          Buffer.from(media.data),
          media.mimeType,
          resolved.credentials
        );
      } else {
        result = await postTweet(post.content, resolved.credentials);
      }
    } else {
      result = await postTweet(post.content, resolved.credentials);
    }

    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: result.success ? "posted" : "failed",
        postedAt: result.success ? new Date() : null,
        tweetId: result.tweetId || null,
        error: result.error || null,
      },
    });

    console.log(
      `Post ${post.id} ${result.success ? "posted successfully" : "failed"}`
    );
  }

  return duePosts.length;
}

export async function processRecurringSchedules() {
  const now = new Date();

  const dueSchedules = await prisma.recurringSchedule.findMany({
    where: {
      isActive: true,
      nextRunAt: { lte: now },
      userId: { not: null },
    },
  });

  console.log(`Found ${dueSchedules.length} recurring schedules to process`);

  for (const schedule of dueSchedules) {
    console.log(`Processing recurring schedule ${schedule.id}`);

    const resolved = await getUserXCredentials(
      schedule.userId!,
      schedule.xAccountId
    );
    if (!resolved) {
      console.log(`Schedule ${schedule.id} skipped: no credentials`);
      continue;
    }

    let contentToPost = schedule.content;
    let generationError: string | null = null;
    const decodedAiPrompt = decodeRecurringAiPrompt(schedule.aiPrompt);
    const imageModelId = decodedAiPrompt.imageModelId;

    if (schedule.useAi) {
      const userHasCredits = await hasCredits(schedule.userId!);
      if (!userHasCredits) {
        generationError = "Insufficient credits for AI generation";
      } else {
        const [sources, recentPostsRows] = await Promise.all([
          prisma.knowledgeSource.findMany({
            where: { isActive: true, userId: schedule.userId },
          }),
          prisma.post.findMany({
            where: { userId: schedule.userId!, status: "posted" },
            orderBy: { postedAt: "desc" },
            take: 5,
            select: { content: true },
          }),
        ]);
        const recentPosts = recentPostsRows.map((p) => p.content);

        if (sources.length === 0) {
          generationError =
            "No knowledge sources found for AI recurring generation";
        } else {
          const knowledgeContext = sources
            .map((source) => {
              const truncatedContent =
                source.content.length > 2000
                  ? source.content.substring(0, 2000) + "..."
                  : source.content;
              return `Source: ${source.name} (${source.url})\n${truncatedContent}`;
            })
            .join("\n\n---\n\n");

          // 如果设置了 trendRegion，获取热点并注入 prompt
          let effectivePrompt = decodedAiPrompt.prompt || undefined;
          if (schedule.trendRegion) {
            try {
              effectivePrompt = await buildTrendPrompt(
                schedule.userId!,
                schedule.trendRegion,
                decodedAiPrompt.prompt,
              );
            } catch (trendErr) {
              console.warn("Failed to fetch trends for scheduler, using base prompt:", trendErr);
            }
          }

          const generated = await generateTweet(
            knowledgeContext,
            effectivePrompt,
            schedule.aiLanguage || undefined,
            recentPosts
          );

          if (generated.usage) {
            try {
              await trackTokenUsage({
                userId: schedule.userId!,
                source: "recurring_scheduler_ai",
                usage: generated.usage,
                model: generated.model,
                metadata: { scheduleId: schedule.id },
              });
              await deductCredits({
                userId: schedule.userId!,
                usage: generated.usage,
                model: generated.model,
                source: "recurring_scheduler_ai",
              });
            } catch (error) {
              console.error("Failed to track/deduct recurring AI usage:", error);
            }
          }

          if (!generated.success || !generated.content) {
            generationError = generated.error || "Failed to generate AI content";
          } else {
            contentToPost = generated.content;
          }
        }
      }
    }
    let result:
      | { success: true; tweetId?: string; error?: string }
      | { success: false; tweetId?: string | null; error?: string | null };
    if (generationError) {
      result = { success: false as const, error: generationError, tweetId: null };
    } else if (imageModelId) {
      try {
        const imageFeeCents = getWavespeedFeeCents(imageModelId, "image");
        const balance = await getCreditBalance(schedule.userId!);
        if (balance < imageFeeCents) {
          throw new Error(
            `Insufficient credits for recurring image generation (need $${(
              imageFeeCents / 100
            ).toFixed(2)})`
          );
        }

        const task = await submitImageTask({
          modelId: imageModelId,
          prompt: contentToPost,
          aspectRatio: "16:9",
        });
        const pollKey = task.outputs?.[0] ? task.id : task.urls?.get || task.id;
        const settled = task.outputs?.[0]
          ? { outputUrl: task.outputs[0], taskId: task.id }
          : await waitForImageOutput(pollKey);
        const media = await fetchBinary(settled.outputUrl);
        result = await postTweetWithMedia(
          contentToPost,
          media.buffer,
          media.mimeType,
          resolved.credentials
        );

        if (result.success) {
          try {
            await deductWavespeedCredits({
              userId: schedule.userId!,
              modelId: imageModelId,
              mediaType: "image",
              source: "recurring_scheduler_image",
              taskId: settled.taskId,
            });
            await trackWavespeedUsage({
              userId: schedule.userId!,
              source: "recurring_scheduler_image",
              model: imageModelId,
              prompt: contentToPost,
              metadata: {
                scheduleId: schedule.id,
                taskId: settled.taskId,
                aspectRatio: "16:9",
              },
            });
          } catch (usageError) {
            console.error("Failed to track/deduct recurring image usage:", usageError);
          }
        }
      } catch (error) {
        result = {
          success: false,
          error: error instanceof Error ? error.message : "Recurring image generation failed",
          tweetId: null,
        };
      }
    } else {
      result = await postTweet(contentToPost, resolved.credentials);
    }

    await prisma.post.create({
      data: {
        content: contentToPost,
        status: result.success ? "posted" : "failed",
        postedAt: result.success ? new Date() : null,
        tweetId: result.tweetId || null,
        error: result.error || null,
        xAccountId: resolved.accountId,
        userId: schedule.userId,
      },
    });

    const [hours, minutes] = schedule.cronExpr.split(":").map(Number);
    let nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    if (schedule.frequency in HOURLY_FREQUENCIES) {
      nextRun = addHours(new Date(), HOURLY_FREQUENCIES[schedule.frequency].hours);
    } else {
      switch (schedule.frequency) {
        case "daily":
          nextRun = addDays(nextRun, 1);
          break;
        case "weekly":
          nextRun = addWeeks(nextRun, 1);
          break;
        case "monthly":
          nextRun = addMonths(nextRun, 1);
          break;
      }
    }

    await prisma.recurringSchedule.update({
      where: { id: schedule.id },
      data: { nextRunAt: nextRun },
    });

    console.log(
      `Recurring schedule ${schedule.id} ${
        result.success ? "posted successfully" : "failed"
      }, next run: ${nextRun}`
    );
  }

  return dueSchedules.length;
}

export async function runScheduler() {
  console.log("Running scheduler at", new Date().toISOString());

  try {
    const postsProcessed = await processScheduledPosts();
    const schedulesProcessed = await processRecurringSchedules();

    return {
      success: true,
      postsProcessed,
      schedulesProcessed,
    };
  } catch (error) {
    console.error("Scheduler error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
