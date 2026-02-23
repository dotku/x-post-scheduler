// scripts/stitch-existing-jobs.ts
import "dotenv/config";
import { prisma } from "../lib/db";
import { stitchVideos } from "../lib/video-stitch";

async function main() {
  console.log("Checking for unstitched video jobs...");
  
  const jobs = await prisma.videoJob.findMany({
    where: {
      OR: [
        { status: "completed" },
        { status: "partial" }
      ],
      stitchedUrl: null,
      completedUrls: {
        not: null
      }
    }
  });

  console.log(`Found ${jobs.length} jobs to process.`);

  for (const job of jobs) {
    try {
      if (!job.completedUrls) continue;
      
      const urls = JSON.parse(job.completedUrls) as string[];
      if (urls.length < 2) {
        console.log(`Job ${job.id}: Only ${urls.length} completed URLs, skipping stitch.`);
        continue;
      }

      console.log(`Job ${job.id}: Stitching ${urls.length} videos...`);
      const stitchedUrl = await stitchVideos(urls);
      
      await prisma.videoJob.update({
        where: { id: job.id },
        data: { stitchedUrl }
      });
      console.log(`Job ${job.id}: Stitched successfully -> ${stitchedUrl}`);
      
    } catch (e) {
      console.error(`Job ${job.id}: Failed to stitch`, e);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
