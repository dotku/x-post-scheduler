import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { optimizeHashtags } from "@/lib/hashtag-optimizer";
import { fetchTrendingTopics } from "@/lib/trending";

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!content || content.length < 10) {
    return NextResponse.json(
      { error: "Content must be at least 10 characters" },
      { status: 400 },
    );
  }

  // Fetch current trending topics (USA region, WOEID 1)
  let trendingTopics: string[] = [];
  try {
    const result = await fetchTrendingTopics(user.id, 1);
    trendingTopics = (result.trends ?? [])
      .map((t) => t.name)
      .filter(Boolean);
  } catch {
    // If trending API fails, return original content
    return NextResponse.json({ content, hashtags: [], unchanged: true });
  }

  const result = await optimizeHashtags(content, trendingTopics);

  return NextResponse.json({
    content: result.content,
    hashtags: result.hashtags,
    unchanged: result.content === content,
  });
}
