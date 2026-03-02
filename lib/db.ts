import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const hasExpectedDelegates = (client: PrismaClient | undefined) =>
  !!client &&
  "user" in client &&
  "post" in client &&
  "recurringSchedule" in client &&
  "knowledgeSource" in client &&
  "knowledgeImage" in client &&
  "mediaAsset" in client &&
  "xAccount" in client &&
  "usageEvent" in client &&
  "creditTransaction" in client &&
  "cronRunEvent" in client &&
  "webVisit" in client &&
  "videoJob" in client &&
  "mediaIndustryReport" in client &&
  "galleryLike" in client &&
  "galleryComment" in client &&
  "userFollow" in client &&
  "campaign" in client &&
  "campaignMaterial" in client &&
  "campaignAttachment" in client &&
  "campaignPayment" in client &&
  "payout" in client;

const cachedClient = globalForPrisma.prisma;
const prismaClient = hasExpectedDelegates(cachedClient)
  ? cachedClient
  : new PrismaClient();

if (cachedClient && cachedClient !== prismaClient) {
  // HMR can keep an old client instance around after Prisma schema changes.
  void cachedClient.$disconnect().catch(() => undefined);
}

export const prisma = prismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
