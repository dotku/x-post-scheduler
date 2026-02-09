import cron from "node-cron";
import { runScheduler } from "../lib/scheduler";

console.log("Starting X Post Scheduler background worker...");

// Run every minute to check for due posts
cron.schedule("* * * * *", async () => {
  console.log("Checking for scheduled posts...");
  const result = await runScheduler();
  if (result.success) {
    console.log(
      `Processed ${result.postsProcessed} posts, ${result.schedulesProcessed} recurring schedules`
    );
  } else {
    console.error("Scheduler error:", result.error);
  }
});

console.log("Scheduler is running. Press Ctrl+C to stop.");
