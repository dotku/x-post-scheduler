import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function toNumber(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") return Number(value);
  return value ?? 0;
}

function isMissingWebVisitRelationError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { message?: unknown; meta?: unknown };
  const message =
    typeof candidate.message === "string" ? candidate.message : "";
  const meta = JSON.stringify(candidate.meta ?? {});
  return (
    message.includes("42P01") ||
    message.includes('relation "WebVisit" does not exist') ||
    meta.includes("42P01")
  );
}

export async function GET() {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const preferVercelAnalytics =
    (process.env.ANALYTICS_PREFER_VERCEL ?? "true") === "true";
  const vercelDrainLike = "vercel-drain:%";

  const [
    totalUsers,
    totalPosts,
    totalGalleryItems,
    totalKnowledgeSources,
    allUsage,
    usage30d,
    byProvider30d,
    topModels30d,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.galleryItem.count(),
    prisma.knowledgeSource.count({ where: { isActive: true } }),
    prisma.usageEvent.aggregate({
      _sum: { totalTokens: true },
      _count: { _all: true },
    }),
    prisma.usageEvent.aggregate({
      where: { createdAt: { gte: since30d } },
      _sum: { totalTokens: true },
      _count: { _all: true },
    }),
    prisma.usageEvent.groupBy({
      by: ["provider"],
      where: { createdAt: { gte: since30d } },
      _sum: { totalTokens: true },
      _count: { _all: true },
      orderBy: { _count: { provider: "desc" } },
    }),
    prisma.usageEvent.groupBy({
      by: ["provider", "model"],
      where: { createdAt: { gte: since30d } },
      _sum: { totalTokens: true },
      _count: { _all: true },
      orderBy: { _count: { model: "desc" } },
      take: 8,
    }),
  ]);

  let allVisits = 0;
  let visits30d = 0;
  let topPages30d: Array<{ path: string; visits: bigint }> = [];
  try {
    const hasWebVisitTable = await prisma.$queryRaw<
      Array<{ exists: string | null }>
    >`
      SELECT to_regclass('public."WebVisit"')::text AS exists
    `;
    if (hasWebVisitTable[0]?.exists) {
      const [
        allVisitsResult,
        visits30dResult,
        topPages,
        vercelAllVisitsResult,
        vercelVisits30dResult,
        vercelTopPages,
      ] = await Promise.all([
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "WebVisit"
        `,
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "WebVisit"
          WHERE "createdAt" >= ${since30d}
        `,
        prisma.$queryRaw<Array<{ path: string; visits: bigint }>>`
          SELECT "path", COUNT(*)::bigint AS visits
          FROM "WebVisit"
          WHERE "createdAt" >= ${since30d}
          GROUP BY "path"
          ORDER BY visits DESC
          LIMIT 8
        `,
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "WebVisit"
          WHERE "userAgent" LIKE ${vercelDrainLike}
        `,
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "WebVisit"
          WHERE "createdAt" >= ${since30d}
            AND "userAgent" LIKE ${vercelDrainLike}
        `,
        prisma.$queryRaw<Array<{ path: string; visits: bigint }>>`
          SELECT "path", COUNT(*)::bigint AS visits
          FROM "WebVisit"
          WHERE "createdAt" >= ${since30d}
            AND "userAgent" LIKE ${vercelDrainLike}
          GROUP BY "path"
          ORDER BY visits DESC
          LIMIT 8
        `,
      ]);
      const allVisitsCount = toNumber(allVisitsResult[0]?.count);
      const visits30dCount = toNumber(visits30dResult[0]?.count);
      const vercelAllVisitsCount = toNumber(vercelAllVisitsResult[0]?.count);
      const vercelVisits30dCount = toNumber(vercelVisits30dResult[0]?.count);
      const useVercel = preferVercelAnalytics && vercelVisits30dCount > 0;

      allVisits = useVercel ? vercelAllVisitsCount : allVisitsCount;
      visits30d = useVercel ? vercelVisits30dCount : visits30dCount;
      topPages30d = useVercel ? vercelTopPages : topPages;
    }
  } catch (error) {
    if (!isMissingWebVisitRelationError(error)) {
      console.error("Failed to load public web visit stats:", error);
    }
  }

  const response = NextResponse.json({
    totals: {
      users: totalUsers,
      posts: totalPosts,
      galleryItems: totalGalleryItems,
      knowledgeSources: totalKnowledgeSources,
      requests: allUsage._count._all,
      tokens: allUsage._sum.totalTokens ?? 0,
      webVisits: allVisits,
    },
    window30d: {
      requests: usage30d._count._all,
      tokens: usage30d._sum.totalTokens ?? 0,
      webVisits: visits30d,
      topPages: topPages30d.map((row) => ({
        path: row.path,
        visits: toNumber(row.visits),
      })),
      byProvider: byProvider30d.map(
        (row: {
          provider: string | null;
          _count: { _all: number };
          _sum: { totalTokens: number | null };
        }) => ({
          provider: row.provider || "unknown",
          requests: row._count._all,
          tokens: row._sum.totalTokens ?? 0,
        }),
      ),
      topModels: topModels30d.map(
        (row: {
          provider: string | null;
          model: string | null;
          _count: { _all: number };
          _sum: { totalTokens: number | null };
        }) => ({
          provider: row.provider || "unknown",
          model: row.model || "unknown",
          requests: row._count._all,
          tokens: row._sum.totalTokens ?? 0,
        }),
      ),
    },
    updatedAt: new Date().toISOString(),
  });

  response.headers.set(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600",
  );
  return response;
}
