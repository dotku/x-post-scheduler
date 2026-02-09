import { prisma } from "./db";
import { postTweet } from "./x-client";
import { addDays, addWeeks, addMonths } from "date-fns";

// Process scheduled posts that are due
export async function processScheduledPosts() {
  const now = new Date();

  // Find all scheduled posts that are due
  const duePosts = await prisma.post.findMany({
    where: {
      status: "scheduled",
      scheduledAt: {
        lte: now,
      },
    },
  });

  console.log(`Found ${duePosts.length} posts to process`);

  for (const post of duePosts) {
    console.log(`Processing post ${post.id}: ${post.content.substring(0, 50)}...`);

    const result = await postTweet(post.content);

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

// Process recurring schedules that are due
export async function processRecurringSchedules() {
  const now = new Date();

  // Find all active recurring schedules that are due
  const dueSchedules = await prisma.recurringSchedule.findMany({
    where: {
      isActive: true,
      nextRunAt: {
        lte: now,
      },
    },
  });

  console.log(`Found ${dueSchedules.length} recurring schedules to process`);

  for (const schedule of dueSchedules) {
    console.log(`Processing recurring schedule ${schedule.id}`);

    // Post the content
    const result = await postTweet(schedule.content);

    // Create a post record
    await prisma.post.create({
      data: {
        content: schedule.content,
        status: result.success ? "posted" : "failed",
        postedAt: result.success ? new Date() : null,
        tweetId: result.tweetId || null,
        error: result.error || null,
      },
    });

    // Calculate next run time
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

// Run all scheduled tasks
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
