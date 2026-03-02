import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const WORKER_URL = process.env.WEIXIN_WORKER_URL || "http://localhost:8080";
const WORKER_SECRET = process.env.WEIXIN_WORKER_SECRET || "";

const prisma = new PrismaClient();

async function main() {
  // Get user with cookies
  const user = await prisma.user.findFirst({
    where: { weixinCookie: { not: null } },
    select: { email: true, weixinCookie: true },
  });

  if (!user || !user.weixinCookie) {
    console.log("No user with cookies found");
    return;
  }

  console.log(`Using cookies from: ${user.email}`);
  const cookies = JSON.parse(user.weixinCookie);
  console.log(`Cookie count: ${cookies.length}`);

  // Call the scrape endpoint
  console.log(`\nCalling ${WORKER_URL}/scrape/channel...`);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (WORKER_SECRET) {
    headers["Authorization"] = `Bearer ${WORKER_SECRET}`;
  }

  const res = await fetch(`${WORKER_URL}/scrape/channel`, {
    method: "POST",
    headers,
    body: JSON.stringify({ cookies }),
    signal: AbortSignal.timeout(120000),
  });

  const text = await res.text();
  console.log(`\nResponse status: ${res.status}`);
  try {
    const json = JSON.parse(text);

    // Save screenshot if present
    if (json.debugScreenshot) {
      const base64Data = json.debugScreenshot.replace(/^data:image\/png;base64,/, "");
      writeFileSync("/tmp/weixin-scrape-debug.png", Buffer.from(base64Data, "base64"));
      console.log("Screenshot saved to /tmp/weixin-scrape-debug.png");
      delete json.debugScreenshot;
    }

    // Print debug API URLs
    if (json.debugApiUrls) {
      console.log(`\nDebug API URLs (${json.debugApiUrls.length}):`);
      for (const url of json.debugApiUrls) {
        console.log(`  ${url}`);
      }
      delete json.debugApiUrls;
    }

    console.log(`\nResponse: ${JSON.stringify(json, null, 2)}`);
  } catch {
    console.log(`Raw response: ${text.substring(0, 1000)}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
