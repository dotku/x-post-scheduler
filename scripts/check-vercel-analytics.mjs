import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

try {
  const now = Date.now();
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [totalRows, rows30d, rows7d, allRows, allRows30d] = await Promise.all([
    prisma.webVisit.count({
      where: { userAgent: { startsWith: "vercel-drain:" } },
    }),
    prisma.webVisit.count({
      where: {
        createdAt: { gte: since30d },
        userAgent: { startsWith: "vercel-drain:" },
      },
    }),
    prisma.webVisit.count({
      where: {
        createdAt: { gte: since7d },
        userAgent: { startsWith: "vercel-drain:" },
      },
    }),
    prisma.webVisit.count(),
    prisma.webVisit.count({
      where: { createdAt: { gte: since30d } },
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        vercelDrainRowsTotal: totalRows,
        vercelDrainRows30d: rows30d,
        vercelDrainRows7d: rows7d,
        webVisitRowsTotal: allRows,
        webVisitRows30d: allRows30d,
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
