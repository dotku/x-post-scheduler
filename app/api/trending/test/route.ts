import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { fetchTrendingTopics } from "@/lib/trending";

// 测试专用 — 仅限已登录用户，不校验会员等级
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const region = request.nextUrl.searchParams.get("region") || "global";

  const woeids: Record<string, number> = {
    global: 1,
    usa: 23424977,
    china: 23424856,
    africa: 23424908,
  };

  const woeid = woeids[region] ?? 1;
  const result = await fetchTrendingTopics(user.id, woeid);
  return NextResponse.json(result);
}
