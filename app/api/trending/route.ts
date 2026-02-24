import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { fetchTrendingTopics, fetchMultiRegionalTrends } from "@/lib/trending";
import { prisma } from "@/lib/db";
import { isTierAtLeast } from "@/lib/subscription";

export async function GET(request: NextRequest) {
  try {
    let user = null;
    try {
      user = await requireAuth();
    } catch {
      return unauthorizedResponse();
    }

    // 仅白银及以上会员可使用热点功能
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { subscriptionTier: true, subscriptionStatus: true },
    });

    if (!isTierAtLeast(dbUser?.subscriptionTier, "silver") || dbUser?.subscriptionStatus !== "active") {
      return NextResponse.json(
        { success: false, error: "TIER_REQUIRED", minTier: "silver" },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const region = searchParams.get("region") || "global";
    const multi = searchParams.get("multi") === "true";

    if (multi) {
      const result = await fetchMultiRegionalTrends(user.id, region as any);
      return NextResponse.json(result);
    } else {
      const woeids: Record<string, number> = {
        global: 1,
        usa: 23424977,
        china: 23424856,
        uk: 2988,
        japan: 23424819,
        mexico: 23424829,
        india: 23424982,
        south_africa: 23424908,
        nigeria: 23424768,
        egypt: 23424785,
        kenya: 23424809,
        africa: 23424908,
      };

      const woeid = woeids[region] || 1;
      const result = await fetchTrendingTopics(user.id, woeid);

      const response = NextResponse.json(result);
      response.headers.set("Cache-Control", "public, max-age=900");
      return response;
    }
  } catch (error) {
    console.error("Error in trending API:", error);
    if (error instanceof Error && error.message.includes("auth")) {
      return unauthorizedResponse();
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch trending topics" },
      { status: 500 },
    );
  }
}
