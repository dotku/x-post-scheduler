// scripts/trigger-video-jobs.ts
import { processAllPendingJobs } from "../lib/video-job-processor";
import { prisma } from "../lib/db";

async function main() {
  console.log("Starting video job processing...");
  await processAllPendingJobs();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
