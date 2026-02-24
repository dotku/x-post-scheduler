import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: "weijingjaylin@gmail.com" },
    select: { id: true },
  });
  if (!user) { console.log("user not found"); return; }

  const accounts = await prisma.xAccount.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      username: true,
      followersCount: true,
      followingCount: true,
      lastSyncedAt: true,
    },
  });
  console.log(JSON.stringify(accounts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
