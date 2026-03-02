import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, weixinCookie: true },
  });
  for (const u of users) {
    const hasCookies = u.weixinCookie ? true : false;
    const cookieLen = u.weixinCookie ? u.weixinCookie.length : 0;
    console.log(`User: ${u.email} | hasCookies: ${hasCookies} | cookieLen: ${cookieLen}`);
    if (u.weixinCookie) {
      const cookies = JSON.parse(u.weixinCookie);
      console.log(`Cookie count: ${cookies.length}`);
      console.log(`Cookie names: ${cookies.map((c: Record<string, string>) => c.name).join(", ")}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
