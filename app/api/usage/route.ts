import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

function toPositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const days = Math.min(toPositiveInt(request.nextUrl.searchParams.get("days"), 30), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [windowAgg, allTimeAgg, bySource, recent] = await Promise.all([
    prisma.usageEvent.aggregate({
      where: { userId: user.id, createdAt: { gte: since } },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
      },
      _count: { _all: true },
    }),
    prisma.usageEvent.aggregate({
      where: { userId: user.id },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
      },
      _count: { _all: true },
    }),
    prisma.usageEvent.groupBy({
      by: ["source"],
      where: { userId: user.id, createdAt: { gte: since } },
      _sum: { totalTokens: true },
      _count: { _all: true },
      orderBy: { _sum: { totalTokens: "desc" } },
    }),
    prisma.usageEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        provider: true,
        source: true,
        model: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
      },
    }),
  ]);

  return NextResponse.json({
    rangeDays: days,
    window: {
      requests: windowAgg._count._all,
      promptTokens: windowAgg._sum.promptTokens ?? 0,
      completionTokens: windowAgg._sum.completionTokens ?? 0,
      totalTokens: windowAgg._sum.totalTokens ?? 0,
    },
    allTime: {
      requests: allTimeAgg._count._all,
      promptTokens: allTimeAgg._sum.promptTokens ?? 0,
      completionTokens: allTimeAgg._sum.completionTokens ?? 0,
      totalTokens: allTimeAgg._sum.totalTokens ?? 0,
    },
    bySource: bySource.map((row) => ({
      source: row.source,
      requests: row._count._all,
      totalTokens: row._sum.totalTokens ?? 0,
    })),
    recent,
  });
}
