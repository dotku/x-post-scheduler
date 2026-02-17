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
  "mediaAsset" in client &&
  "xAccount" in client &&
  "usageEvent" in client;

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
