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

  const posts = await prisma.post.findMany({
    where: {
      userId: user.id,
      status: "posted",
      impressions: { not: null },
      postedAt: { gte: since },
    },
    select: { postedAt: true, impressions: true },
  });

  // Build a map of date string → total impressions
  const dailyMap = new Map<string, number>();

  // Seed all days in the period with 0
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, 0);
  }

  for (const post of posts) {
    if (!post.postedAt || post.impressions == null) continue;
    const key = post.postedAt.toISOString().slice(0, 10);
    if (dailyMap.has(key)) {
      dailyMap.set(key, dailyMap.get(key)! + post.impressions);
    }
  }

  const data = Array.from(dailyMap.entries()).map(([date, impressions]) => ({
    date,
    impressions,
  }));

  return NextResponse.json({ data, period });
}
