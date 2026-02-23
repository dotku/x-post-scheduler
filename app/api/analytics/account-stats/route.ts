import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period") ?? "30";
  const period = [7, 30, 90].includes(Number(periodParam)) ? Number(periodParam) : 30;

  const since = new Date();
  since.setDate(since.getDate() - period);

  const [accounts, posts, siteViews] = await Promise.all([
    prisma.xAccount.findMany({
      where: { userId: user.id },
      select: { id: true, label: true, username: true, isDefault: true },
    }),
    prisma.post.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: since },
      },
      select: { xAccountId: true, status: true, impressions: true },
    }),
    prisma.webVisit.count({
      where: { createdAt: { gte: since } },
    }),
  ]);

  // Aggregate counts by account
  const accountMap = new Map<string, { posted: number; scheduled: number; failed: number; impressions: number }>();
  for (const post of posts) {
    const key = post.xAccountId ?? "__none__";
    if (!accountMap.has(key)) {
      accountMap.set(key, { posted: 0, scheduled: 0, failed: 0, impressions: 0 });
    }
    const entry = accountMap.get(key)!;
    if (post.status === "posted") entry.posted++;
    else if (post.status === "scheduled") entry.scheduled++;
    else if (post.status === "failed") entry.failed++;
    entry.impressions += post.impressions ?? 0;
  }

  const accountStats = accounts.map((acc) => {
    const counts = accountMap.get(acc.id) ?? { posted: 0, scheduled: 0, failed: 0, impressions: 0 };
    return {
      accountId: acc.id,
      label: acc.label,
      username: acc.username,
      isDefault: acc.isDefault,
      ...counts,
      total: counts.posted + counts.scheduled + counts.failed,
    };
  });

  // Include any posts with no account linked
  const noAccount = accountMap.get("__none__");
  const totals = {
    posted: posts.filter((p) => p.status === "posted").length,
    scheduled: posts.filter((p) => p.status === "scheduled").length,
    failed: posts.filter((p) => p.status === "failed").length,
    total: posts.length,
    impressions: posts.reduce((sum, p) => sum + (p.impressions ?? 0), 0),
    views: siteViews,
  };

  return NextResponse.json({
    period,
    totals,
    accounts: accountStats,
    hasUnlinked: !!noAccount,
    unlinked: noAccount ?? { posted: 0, scheduled: 0, failed: 0 },
  });
}
