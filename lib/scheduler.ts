import { prisma } from "./db";
import { postTweet, postTweetWithMedia } from "./x-client";
import { getUserXCredentials } from "./user-credentials";
import { generateTweet } from "./openai";
import { addDays, addWeeks, addMonths } from "date-fns";

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

    const credentials = await getUserXCredentials(post.userId!);
    if (!credentials) {
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
          credentials
        );
      } else {
        result = await postTweet(post.content, credentials);
      }
    } else {
      result = await postTweet(post.content, credentials);
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

    const credentials = await getUserXCredentials(schedule.userId!);
    if (!credentials) {
      console.log(`Schedule ${schedule.id} skipped: no credentials`);
      continue;
    }

    let contentToPost = schedule.content;
    let generationError: string | null = null;

    if (schedule.useAi) {
      const sources = await prisma.knowledgeSource.findMany({
        where: { isActive: true, userId: schedule.userId },
      });

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

        const generated = await generateTweet(
          knowledgeContext,
          schedule.aiPrompt || undefined,
          schedule.aiLanguage || undefined
        );

        if (!generated.success || !generated.content) {
          generationError = generated.error || "Failed to generate AI content";
        } else {
          contentToPost = generated.content;
        }
      }
    }

    const result = generationError
      ? { success: false as const, error: generationError, tweetId: null }
      : await postTweet(contentToPost, credentials);

    await prisma.post.create({
      data: {
        content: contentToPost,
        status: result.success ? "posted" : "failed",
        postedAt: result.success ? new Date() : null,
        tweetId: result.tweetId || null,
        error: result.error || null,
        userId: schedule.userId,
      },
    });

    const [hours, minutes] = schedule.cronExpr.split(":").map(Number);
    let nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

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
